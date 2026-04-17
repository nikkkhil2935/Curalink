import express from 'express';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import Analytics from '../models/Analytics.js';
import { gzipCompression } from '../middleware/gzipCompression.js';

const router = express.Router();
router.use(gzipCompression());

// Placeholder route. Real PDF generation will be implemented later.
router.post('/:sessionId', async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    const session = await Session.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messageCount = await Message.countDocuments({ sessionId });

    await Analytics.create({
      event: 'export',
      disease: session.disease.toLowerCase(),
      sessionId: session._id,
      metadata: {
        type: 'pdf-placeholder',
        messageCount
      }
    });

    return res.status(202).json({
      status: 'placeholder',
      message: 'PDF export is queued as a placeholder for a later implementation phase.'
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
