import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema(
  {
    event: {
      type: String,
      enum: ['query', 'export', 'trial_click', 'source_click', 'session_start'],
      required: true
    },
    disease: String,
    intentType: String,
    sessionId: mongoose.Schema.Types.ObjectId,
    metadata: mongoose.Schema.Types.Mixed
  },
  { timestamps: true }
);

export default mongoose.model('Analytics', analyticsSchema);
