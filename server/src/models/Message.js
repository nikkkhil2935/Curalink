import mongoose from 'mongoose';

const insightSchema = new mongoose.Schema(
  {
    insight: String,
    type: {
      type: String,
      enum: ['TREATMENT', 'DIAGNOSIS', 'RISK', 'PREVENTION', 'GENERAL']
    },
    source_ids: [String]
  },
  { _id: false }
);

const trialSummarySchema = new mongoose.Schema(
  {
    summary: String,
    status: String,
    location_relevant: Boolean,
    contact: String,
    source_ids: [String]
  },
  { _id: false }
);

const structuredAnswerSchema = new mongoose.Schema(
  {
    condition_overview: String,
    evidence_strength: {
      type: String,
      enum: ['LIMITED', 'MODERATE', 'STRONG']
    },
    research_insights: [insightSchema],
    clinical_trials: [trialSummarySchema],
    key_researchers: [String],
    recommendations: String,
    follow_up_suggestions: [String]
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session',
      required: true
    },
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true
    },
    text: { type: String, required: true },
    structuredAnswer: { type: structuredAnswerSchema, default: null },
    usedSourceIds: [String],
    sourceIndex: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    retrievalStats: {
      totalCandidates: Number,
      pubmedFetched: Number,
      openalexFetched: Number,
      ctFetched: Number,
      rerankedTo: Number,
      timeTakenMs: Number
    },
    intentType: String,
    contextBadge: String
  },
  { timestamps: true }
);

messageSchema.index({ sessionId: 1, createdAt: 1 });
messageSchema.index({ sessionId: 1, role: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);
