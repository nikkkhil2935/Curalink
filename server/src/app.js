import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import sessionRoutes from './routes/sessions.js';
import queryRoutes from './routes/query.js';
import analyticsRoutes from './routes/analytics.js';
import exportRoutes from './routes/export.js';
import { errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*'
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30
});

app.use('/api/', limiter);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
  });

app.use('/api/sessions', sessionRoutes);
app.use('/api', queryRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);

app.get('/api/health', async (req, res) => {
  const llmServiceUrl = process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001';
  let llmStatus = 'offline';
  let llmProvider = null;

  try {
    const response = await fetch(`${llmServiceUrl}/health`);
    if (response.ok) {
      const health = await response.json().catch(() => null);
      llmStatus = health?.status === 'ok' ? 'online' : 'degraded';

      if (health?.providers?.ollama?.status === 'online') {
        llmProvider = 'ollama';
      } else if (health?.providers?.groq?.configured) {
        llmProvider = 'groq';
      }
    }
  } catch (error) {
    llmStatus = 'offline';
  }

  return res.json({
    status: 'ok',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    llm: llmStatus,
    llmProvider,
    timestamp: new Date().toISOString()
  });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
