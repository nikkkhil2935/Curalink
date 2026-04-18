import express from 'express';
import mongoose from 'mongoose';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import sessionRoutes, { bookmarksRouter } from './routes/sessions.js';
import queryRoutes from './routes/query.js';
import analyticsRoutes from './routes/analytics.js';
import exportRoutes from './routes/export.js';
import { startAnalyticsScheduler, stopAnalyticsScheduler } from './services/scheduler.js';
import logger from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load server/.env even when the process is started from the workspace root.
const dotenvResult = dotenv.config({ path: join(__dirname, '..', '.env') });
if (process.env.NODE_ENV !== 'production' && dotenvResult.parsed) {
  // Keep local Mongo URIs stable even when stale shell variables are set.
  for (const key of ['MONGODB_URI', 'MONGODB_URI_FALLBACK']) {
    const value = dotenvResult.parsed[key];
    if (value) {
      process.env[key] = value;
    }
  }
}

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
const APP_VERSION = process.env.APP_VERSION || process.env.npm_package_version || '1.0.0';
const configuredOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowWildcardCors = !isProduction && configuredOrigins.length === 0;
<<<<<<< HEAD

let mongoLastError = null;
let mongoRetryHandle = null;
let mongoMode = 'disconnected';
let memoryServer = null;
=======
let mongoLastError = null;
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

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
app.use(compression());
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
  if (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://')) {
    const protocol = uri.startsWith('mongodb+srv://') ? 'mongodb+srv' : 'mongodb';
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    const afterCredentials = withoutProtocol.includes('@')
      ? withoutProtocol.slice(withoutProtocol.indexOf('@') + 1)
      : withoutProtocol;
    const hostSegment = afterCredentials.split('/')[0] || '<unknown-host>';
    return `${protocol}://${hostSegment}`;
  }

  try {
    const parsed = new URL(uri);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return '<invalid-uri>';
  }
}

<<<<<<< HEAD
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

=======
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
mongoose.connection.on('error', (err) => {
  mongoLastError = err.message;
});

mongoose.connection.on('disconnected', () => {
  mongoLastError = 'MongoDB Atlas disconnected';
});

mongoose.connection.on('connected', () => {
  mongoLastError = null;
});

async function connectMongoAtlasStrict() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const primaryUri = String(process.env.MONGODB_URI || '').trim();
  const fallbackUri = String(process.env.MONGODB_URI_FALLBACK || '').trim();
  const candidates = [];

  if (primaryUri) {
    candidates.push({ name: 'MONGODB_URI', uri: primaryUri, requireSrv: true });
  }

  if (fallbackUri && fallbackUri !== primaryUri) {
    candidates.push({ name: 'MONGODB_URI_FALLBACK', uri: fallbackUri, requireSrv: false });
  }

  if (!candidates.length) {
    throw new Error('MONGODB_URI is required and must point to MongoDB Atlas.');
  }

  const connectionErrors = [];

  for (const candidate of candidates) {
    const { name, uri, requireSrv } = candidate;
    if (!(uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://'))) {
      connectionErrors.push(`${name}: URI must start with "mongodb+srv://" or "mongodb://".`);
      continue;
    }

    if (requireSrv && !uri.startsWith('mongodb+srv://')) {
      connectionErrors.push(`${name}: must be an Atlas SRV URI and start with "mongodb+srv://".`);
      continue;
    }

    try {
      await mongoose.connect(uri, mongoOptions);
      mongoLastError = null;
      console.log(`MongoDB Atlas connected via ${name} (${sanitizeMongoUri(uri)})`);
      return;
    } catch (err) {
      const message = err?.message || 'Unknown MongoDB connection error';
      connectionErrors.push(`${name} (${sanitizeMongoUri(uri)}): ${message}`);
      await mongoose.disconnect().catch(() => {});
    }
  }

  const reason = connectionErrors.join(' | ');
  mongoLastError = reason;
  throw new Error(`Failed to connect to MongoDB Atlas. Attempted ${candidates.length} URI(s): ${reason}`);
}

app.use('/api', (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
<<<<<<< HEAD
      error: `Database is unavailable. Verify database connectivity and retry.`
=======
      error: 'Database is unavailable (Atlas disconnected). Verify MONGODB_URI connectivity and retry.'
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    });
  }

  return next();
});

app.use('/api/sessions', sessionRoutes);
app.use('/api/sessions', exportRoutes);
app.use('/api', bookmarksRouter);
app.use('/api', queryRoutes);
app.use('/api/analytics', analyticsRoutes);

<<<<<<< HEAD
async function healthHandler(req, res) {
=======
function normalizeServiceStatus(value, fallback = 'offline') {
  const normalized = String(value || '').trim().toLowerCase();

  if (normalized === 'ok' || normalized === 'online' || normalized === 'connected') {
    return 'online';
  }

  if (normalized === 'degraded') {
    return 'degraded';
  }

  if (normalized === 'offline' || normalized === 'disconnected' || normalized === 'error') {
    return 'offline';
  }

  return fallback;
}

async function getLlmServiceStatus() {
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
  const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001';

  try {
    const response = await fetch(`${llmServiceUrl}/health`);
    if (!response.ok) {
      return 'offline';
    }

    const health = await response.json().catch(() => null);

    if (health?.services?.llm) {
      return normalizeServiceStatus(health.services.llm, 'degraded');
    }

    if (health?.status) {
      return normalizeServiceStatus(health.status, 'degraded');
    }

    return 'degraded';
  } catch (error) {
    return 'offline';
  }
}

function buildHealthPayload(dbStatus, llmStatus) {
  const apiStatus = dbStatus === 'connected' ? 'online' : 'degraded';
  return {
    status: dbStatus === 'connected' && llmStatus === 'online' ? 'ok' : 'degraded',
    version: APP_VERSION,
    uptime_ms: Math.round(process.uptime() * 1000),
    api: apiStatus,
    llm: llmStatus,
    db: dbStatus,
    services: {
      api: apiStatus,
      llm: llmStatus,
      db: dbStatus
    },
    ...(mongoLastError ? { db_error: mongoLastError } : {}),
    timestamp: new Date().toISOString()
  };
}

async function healthHandler(req, res) {
  const dbConnected = mongoose.connection.readyState === 1;
  const dbStatus = dbConnected ? 'connected' : 'disconnected';
  const llmStatus = await getLlmServiceStatus();
  const payload = buildHealthPayload(dbStatus, llmStatus);

  if (!dbConnected) {
    return res.status(503).json(payload);
  }

  return res.status(200).json(payload);
}

<<<<<<< HEAD
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
=======
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

async function shutdown() {
  stopAnalyticsScheduler();

  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => resolve());
    });
    httpServer = null;
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect().catch(() => {});
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

export async function startServer(port = PORT) {
  if (httpServer) {
    return httpServer;
  }

  await connectMongoAtlasStrict();

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
  startServer(PORT).catch((err) => {
    console.error(`Server startup failed: ${err?.message || err}`);
    process.exit(1);
  });
}

export default app;
