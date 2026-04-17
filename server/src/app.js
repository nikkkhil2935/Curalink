import express from 'express';
import mongoose from 'mongoose';
import { pathToFileURL } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import sessionRoutes from './routes/sessions.js';
import queryRoutes from './routes/query.js';
import analyticsRoutes from './routes/analytics.js';
import exportRoutes from './routes/export.js';
import { startAnalyticsScheduler, stopAnalyticsScheduler } from './services/scheduler.js';
import logger from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowWildcardCors = !isProduction && configuredOrigins.length === 0;

let mongoLastError = null;
let mongoRetryHandle = null;
let mongoMode = 'disconnected';
let memoryServer = null;

const mongoRetryMs = Number.parseInt(process.env.MONGODB_RETRY_MS || '15000', 10);
const mongoOptions = {
  serverSelectionTimeoutMS: Number.parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000', 10),
  connectTimeoutMS: Number.parseInt(process.env.MONGODB_CONNECT_TIMEOUT_MS || '10000', 10),
  socketTimeoutMS: Number.parseInt(process.env.MONGODB_SOCKET_TIMEOUT_MS || '30000', 10),
  maxPoolSize: Number.parseInt(process.env.MONGODB_MAX_POOL_SIZE || '20', 10),
  minPoolSize: Number.parseInt(process.env.MONGODB_MIN_POOL_SIZE || '0', 10),
  maxIdleTimeMS: Number.parseInt(process.env.MONGODB_MAX_IDLE_MS || '30000', 10)
};

app.use(helmet());
const trustProxyEnv = process.env.TRUST_PROXY;
if (trustProxyEnv !== undefined) {
  const numericTrustProxy = Number.parseInt(trustProxyEnv, 10);
  app.set('trust proxy', Number.isNaN(numericTrustProxy) ? trustProxyEnv === 'true' : numericTrustProxy);
} else {
  app.set('trust proxy', 0);
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowWildcardCors || configuredOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => req.path === '/health'
});

const queryLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

app.use('/api/', apiLimiter);
app.use('/api/sessions/:id/query', queryLimiter);

// Fail fast on disconnected MongoDB instead of buffering model operations.
mongoose.set('bufferCommands', false);

function sanitizeMongoUri(uri) {
  try {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '<invalid-uri>';
  }
}

function getMongoCandidates() {
  const candidates = [];
  const seenUris = new Set();

  const pushCandidate = (uri, label) => {
    const normalized = typeof uri === 'string' ? uri.trim() : '';
    if (!normalized || seenUris.has(normalized)) {
      return;
    }

    seenUris.add(normalized);
    candidates.push({ uri: normalized, label });
  };

  pushCandidate(process.env.MONGODB_URI, 'primary');
  pushCandidate(process.env.MONGODB_URI_FALLBACK, 'fallback');

  const allowLocalFallback = (process.env.MONGODB_ALLOW_LOCAL_FALLBACK || 'false').toLowerCase() === 'true';
  if (allowLocalFallback) {
    pushCandidate(process.env.MONGODB_URI_LOCAL, 'local');
  }

  if (candidates.length === 0) {
    logger.error('No MongoDB URI configured. Set MONGODB_URI (and optional fallback/local variables).');
  }

  return candidates;
}

async function connectMongoUri(uri, label) {
  try {
    await mongoose.connect(uri, mongoOptions);
    mongoLastError = null;
    mongoMode = label;
    logger.info(`MongoDB connected (${label})`);
    return true;
  } catch (err) {
    mongoLastError = err.message;
    logger.error(`MongoDB connection error (${label}: ${sanitizeMongoUri(uri)}): ${err.message}`);
    return false;
  }
}

async function connectInMemoryMongo() {
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create({
      instance: { dbName: 'curalink' }
    });

    const inMemoryUri = memoryServer.getUri();
    const connected = await connectMongoUri(inMemoryUri, 'memory');

    if (!connected && memoryServer) {
      await memoryServer.stop();
      memoryServer = null;
    }

    return connected;
  } catch (err) {
    mongoLastError = `In-memory MongoDB unavailable: ${err.message}`;
    logger.error(`MongoDB in-memory fallback error: ${err.message}`);
    return false;
  }
}

function scheduleMongoReconnect() {
  if (mongoRetryHandle) {
    return;
  }

  mongoRetryHandle = setTimeout(async () => {
    mongoRetryHandle = null;
    if (mongoose.connection.readyState !== 1) {
      await bootstrapMongoConnection();
    }
  }, mongoRetryMs);
}

async function bootstrapMongoConnection() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  for (const candidate of getMongoCandidates()) {
    const connected = await connectMongoUri(candidate.uri, candidate.label);
    if (connected) {
      return;
    }
  }

  const allowMemoryFallback =
    (process.env.MONGODB_MEMORY_FALLBACK || (!isProduction ? 'true' : 'false')).toLowerCase() !== 'false';

  if (allowMemoryFallback) {
    const connected = await connectInMemoryMongo();
    if (connected) {
      return;
    }
  }

  mongoMode = 'disconnected';
  scheduleMongoReconnect();
}

mongoose.connection.on('error', (err) => {
  mongoLastError = err.message;
  scheduleMongoReconnect();
});

mongoose.connection.on('disconnected', () => {
  mongoMode = 'disconnected';
  scheduleMongoReconnect();
});

mongoose.connection.on('connected', () => {
  mongoLastError = null;
  if (mongoRetryHandle) {
    clearTimeout(mongoRetryHandle);
    mongoRetryHandle = null;
  }
});

bootstrapMongoConnection().catch((err) => {
  mongoLastError = err.message;
  scheduleMongoReconnect();
});

app.use('/api', (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      error: `Database is unavailable. Verify database connectivity and retry.`
    });
  }

  return next();
});

app.use('/api/sessions', sessionRoutes);
app.use('/api', queryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);

async function healthHandler(req, res) {
  const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001';
  let llmStatus = 'offline';
  let llmProvider = null;
  let llmQuality = 'offline';

  try {
    const response = await fetch(`${llmServiceUrl}/health`);
    if (response.ok) {
      const health = await response.json().catch(() => null);
      const providers = health?.providers || {};
      const ollamaOnline = providers?.ollama?.status === 'online';
      const ollamaModelAvailable = providers?.ollama?.model_available !== false;
      const groqConfigured = Boolean(providers?.groq?.configured);
      const localAvailable = Boolean(providers?.local?.available);
      const effectiveProvider = typeof health?.effective_generation_provider === 'string'
        ? health.effective_generation_provider
        : null;

      const hasFullProvider = (ollamaOnline && ollamaModelAvailable) || groqConfigured;

      // Service health should reflect currently available full providers, not only the last used provider.
      if (hasFullProvider) {
        llmStatus = 'online';
        llmQuality = 'full';

        if (effectiveProvider === 'ollama' && ollamaOnline && ollamaModelAvailable) {
          llmProvider = 'ollama';
        } else if (effectiveProvider === 'groq' && groqConfigured) {
          llmProvider = 'groq';
        } else if (ollamaOnline && ollamaModelAvailable) {
          llmProvider = 'ollama';
        } else {
          llmProvider = 'groq';
        }
      } else if (localAvailable) {
        llmProvider = 'local';
        llmQuality = 'degraded';
        llmStatus = 'degraded';
      } else if (health?.status === 'ok') {
        llmStatus = 'degraded';
        llmQuality = 'degraded';
      }
    }
  } catch (error) {
    llmStatus = 'offline';
    llmQuality = 'offline';
  }

  const apiStatus = mongoose.connection.readyState === 1 && llmStatus !== 'offline' ? 'ok' : 'degraded';

  return res.json({
    status: apiStatus,
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    mongodbMode: mongoMode,
    ...(isProduction ? {} : { mongodbError: mongoLastError }),
    llm: llmStatus,
    llmProvider,
    llmQuality,
    timestamp: new Date().toISOString()
  });
}

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

async function shutdown() {
  stopAnalyticsScheduler();

  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => resolve());
    });
    httpServer = null;
  }

  if (mongoRetryHandle) {
    clearTimeout(mongoRetryHandle);
    mongoRetryHandle = null;
  }

  if (memoryServer) {
    await mongoose.disconnect().catch(() => {});
    await memoryServer.stop().catch(() => {});
    memoryServer = null;
  }
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let httpServer = null;

function isDirectExecution() {
  return Boolean(process.argv?.[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;
}

export function startServer(port = PORT) {
  if (httpServer) {
    return httpServer;
  }

  httpServer = app.listen(port, () => {
    logger.info(`Server running on port ${port}`);
    startAnalyticsScheduler();
  });

  httpServer.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use. Stop the existing process or set PORT.`);
      return;
    }

    logger.error(`HTTP server failed to start: ${err?.message || err}`);
  });

  return httpServer;
}

if (isDirectExecution()) {
  startServer(PORT);
}

export default app;
