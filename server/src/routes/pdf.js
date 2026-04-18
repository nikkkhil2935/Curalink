import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';

import Session from '../models/Session.js';
import Analytics from '../models/Analytics.js';
import logger from '../lib/logger.js';
import { getLlmRequestHeaders } from '../lib/llmServiceAuth.js';

const router = express.Router();
const LLM_SERVICE_URL = String(process.env.LLM_SERVICE_URL || 'http://127.0.0.1:8001').replace(/\/+$/, '');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'), false);
    }
    cb(null, true);
  }
});

function isValidSessionId(sessionId) {
  return mongoose.Types.ObjectId.isValid(String(sessionId || ''));
}

async function findSessionOrThrow(sessionId) {
  const session = await Session.findById(sessionId);
  if (!session) {
    const error = new Error('Session not found');
    error.status = 404;
    throw error;
  }
  return session;
}

router.post('/:id/pdf/upload', upload.single('pdf'), async (req, res, next) => {
  try {
    const sessionId = String(req.params.id || '');
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required.' });
    }

    const session = await findSessionOrThrow(sessionId);

    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    formData.append('session_id', String(session._id));

    const { data } = await axios.post(`${LLM_SERVICE_URL}/pdf/ingest`, formData, {
      headers: getLlmRequestHeaders(formData.getHeaders()),
      timeout: 180000
    });

    const uploadedDoc = {
      doc_id: data.doc_id,
      filename: data.filename,
      document_type: data.document_type,
      structured_summary: data.structured_summary,
      abnormal_findings: Array.isArray(data.abnormal_findings) ? data.abnormal_findings : [],
      has_abnormal_findings: Boolean(data.has_abnormal_findings),
      total_chunks: Number(data.total_chunks || 0),
      uploaded_at: new Date()
    };

    // Avoid MongoDB path conflicts by separating dedupe and append operations.
    await Session.updateOne(
      { _id: sessionId },
      {
        $pull: { uploadedDocs: { doc_id: data.doc_id } },
        $set: { updatedAt: new Date() }
      }
    );

    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $push: { uploadedDocs: uploadedDoc },
        $set: { updatedAt: new Date() }
      },
      { new: true, select: 'uploadedDocs' }
    );

    void Analytics.create({
      event: 'pdf_uploaded',
      disease: String(session.disease || '').toLowerCase(),
      sessionId: session._id,
      metadata: {
        doc_id: data.doc_id,
        document_type: data.document_type,
        has_abnormal_findings: Boolean(data.has_abnormal_findings)
      }
    }).catch((error) => {
      logger.error(`Analytics pdf_uploaded logging error: ${error.message}`);
    });

    return res.json({
      ...data,
      uploadedDocs: Array.isArray(updatedSession?.uploadedDocs) ? updatedSession.uploadedDocs : []
    });
  } catch (error) {
    if (error?.response?.status) {
      return res.status(error.response.status).json(
        error.response.data || { error: 'PDF upload failed at LLM service.' }
      );
    }

    return next(error);
  }
});

router.get('/:id/pdf/docs', async (req, res, next) => {
  try {
    const sessionId = String(req.params.id || '');
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const session = await Session.findById(sessionId).select('uploadedDocs');
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const docs = Array.isArray(session.uploadedDocs)
      ? [...session.uploadedDocs].sort(
          (left, right) => new Date(right.uploaded_at || 0).getTime() - new Date(left.uploaded_at || 0).getTime()
        )
      : [];

    return res.json({ docs });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id/pdf/docs/:docId', async (req, res, next) => {
  try {
    const sessionId = String(req.params.id || '');
    const docId = String(req.params.docId || '').trim();

    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }
    if (!docId) {
      return res.status(400).json({ error: 'docId is required' });
    }

    await findSessionOrThrow(sessionId);

    let deletedChunks = 0;
    try {
      const { data } = await axios.delete(`${LLM_SERVICE_URL}/pdf/document/${sessionId}/${encodeURIComponent(docId)}`, {
        headers: getLlmRequestHeaders(),
        timeout: 30000
      });
      deletedChunks = Number(data?.deleted_chunks || 0);
    } catch (error) {
      if (error?.response?.status === 404) {
        deletedChunks = 0;
      } else {
        throw error;
      }
    }

    const updatedSession = await Session.findByIdAndUpdate(
      sessionId,
      {
        $pull: { uploadedDocs: { doc_id: docId } },
        $set: { updatedAt: new Date() }
      },
      { new: true, select: 'uploadedDocs' }
    );

    return res.json({
      doc_id: docId,
      deleted_chunks: deletedChunks,
      uploadedDocs: Array.isArray(updatedSession?.uploadedDocs) ? updatedSession.uploadedDocs : []
    });
  } catch (error) {
    if (error?.response?.status) {
      return res.status(error.response.status).json(
        error.response.data || { error: 'PDF delete failed at LLM service.' }
      );
    }

    return next(error);
  }
});

router.get('/:id/pdf/stats', async (req, res, next) => {
  try {
    const sessionId = String(req.params.id || '');
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    await findSessionOrThrow(sessionId);
    const { data } = await axios.get(`${LLM_SERVICE_URL}/pdf/stats/${sessionId}`, {
      headers: getLlmRequestHeaders(),
      timeout: 30000
    });
    return res.json(data || { total_chunks: 0, doc_ids: [], doc_count: 0 });
  } catch (error) {
    if (error?.response?.status) {
      return res.status(error.response.status).json(
        error.response.data || { error: 'Unable to fetch PDF stats from LLM service.' }
      );
    }

    return next(error);
  }
});

export default router;
