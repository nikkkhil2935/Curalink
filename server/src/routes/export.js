import express from 'express';
import mongoose from 'mongoose';
import Analytics from '../models/Analytics.js';
import { buildCsvExport, buildPdfExport, createSessionExportPayload } from '../services/export.js';

const router = express.Router();
const ALLOWED_FORMATS = new Set(['pdf', 'json', 'csv']);

function toSafeFileName(value) {
  return String(value || 'session')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'session';
}

router.get('/:id/export', async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid session id' });
    }

    const format = String(req.query.format || 'pdf').toLowerCase();
    if (!ALLOWED_FORMATS.has(format)) {
      return res.status(400).json({ error: 'Invalid format. Use pdf, json, or csv.' });
    }

    const payload = await createSessionExportPayload(req.params.id);

    if (!payload?.session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const baseFileName = `curalink-${toSafeFileName(payload.session.disease || payload.session.title || payload.session.id)}`;

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFileName}.json"`);
      await Analytics.create({
        event: 'export',
        disease: (payload.session.disease || '').toLowerCase(),
        sessionId: payload.session.id,
        metadata: {
          format: 'json',
          messageCount: payload.totals?.messageCount || 0,
          evidenceCount: payload.totals?.evidenceCount || 0
        }
      }).catch((err) => {
        console.error('Analytics export logging error:', err.message);
      });

      return res.status(200).json(payload);
    }

    if (format === 'csv') {
      const csv = buildCsvExport(payload);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${baseFileName}.csv"`);
      await Analytics.create({
        event: 'export',
        disease: (payload.session.disease || '').toLowerCase(),
        sessionId: payload.session.id,
        metadata: {
          format: 'csv',
          evidenceCount: payload.totals?.evidenceCount || 0
        }
      }).catch((err) => {
        console.error('Analytics export logging error:', err.message);
      });

      return res.status(200).send(csv);
    }

    const pdfExport = await buildPdfExport(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${baseFileName}.pdf"`);
    res.setHeader('X-Export-Renderer', pdfExport.renderer);

    await Analytics.create({
      event: 'export',
      disease: (payload.session.disease || '').toLowerCase(),
      sessionId: payload.session.id,
      metadata: {
        format: 'pdf',
        renderer: pdfExport.renderer,
        messageCount: payload.totals?.messageCount || 0,
        evidenceCount: payload.totals?.evidenceCount || 0
      }
    }).catch((err) => {
      console.error('Analytics export logging error:', err.message);
    });

    return res.status(200).send(pdfExport.buffer);

  } catch (err) {
    return next(err);
  }
});

export default router;
