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

const confidenceBreakdownEntrySchema = new mongoose.Schema(
  {
    source_id: { type: String, required: true },
    title: { type: String, default: '' },
    relevance_score: { type: Number, default: 0 },
    credibility_score: { type: Number, default: 0 },
    recency_score: { type: Number, default: 0 },
    composite_score: { type: Number, default: 0 }
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
    follow_up_suggestions: [String],
    confidence_breakdown: [confidenceBreakdownEntrySchema]
  },
  { _id: false }
);

const pipelineTimingSchema = new mongoose.Schema(
  {
    stage: String,
    duration_ms: Number
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
      traceId: String,
      totalCandidates: Number,
      pubmedFetched: Number,
      openalexFetched: Number,
      ctFetched: Number,
      rerankedTo: Number,
<<<<<<< HEAD
      timeTakenMs: Number,
      stageTimingsMs: {
        intent: Number,
        expansion: Number,
        retrieval: Number,
        normalization: Number,
        rerank: Number,
        context: Number,
        llm: Number,
        total: Number
      }
=======
      queryContextSimilarity: Number,
      semanticRerankSkipped: Boolean,
      pipeline_timings: [pipelineTimingSchema],
      timeTakenMs: Number
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)
    },
    trace: {
      llm: {
        provider: String,
        model: String,
        elapsed_seconds: Number,
        semantic_cache_hit: Boolean
      },
      pipeline_timings: [pipelineTimingSchema]
    },
    intentType: String,
    contextBadge: String,
    isBookmarked: {
      type: Boolean,
      default: false
    },
    bookmarkedAt: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

messageSchema.index({ sessionId: 1, createdAt: 1 });
messageSchema.index({ sessionId: 1, role: 1, createdAt: -1 });
<<<<<<< HEAD
messageSchema.index({ sessionId: 1, role: 1, 'retrievalStats.traceId': 1, createdAt: -1 });
=======
messageSchema.index({ isBookmarked: 1, bookmarkedAt: -1 });
>>>>>>> 0da9de8 (feat(chat): enhance MessageBubble with citation export functionality and improved UI)

export default mongoose.model('Message', messageSchema);
