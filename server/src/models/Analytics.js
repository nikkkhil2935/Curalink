import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: [
        'query',
        'export',
        'trial_click',
        'source_click',
        'session_start',
        'pdf_uploaded',
        'system_snapshot',
        'conflict_detected',
        'brief_generated'
      ],
      required: true
    },
    disease: String,
    intentType: String,
    sessionId: mongoose.Schema.Types.ObjectId,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

analyticsSchema.index({ event: 1, createdAt: -1 });
analyticsSchema.index({ event: 1, disease: 1 });
analyticsSchema.index({ event: 1, intentType: 1 });

export default mongoose.model('Analytics', analyticsSchema);
