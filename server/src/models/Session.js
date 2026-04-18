import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    disease: { type: String, required: true, trim: true },
    intent: { type: String, trim: true, default: '' },
    location: {
      city: { type: String, default: '' },
      country: { type: String, default: '' }
    },
    demographics: {
      age: { type: Number, default: null },
      ageRange: { type: String, default: '' },
      sex: {
        type: String,
        enum: ['Male', 'Female', 'Other', null],
        default: null
      },
      conditions: {
        type: [String],
        default: []
      }
    },
    brief: {
      generatedAt: { type: Date, default: null },
      background: { type: String, default: '' },
      currentEvidence: { type: String, default: '' },
      conflicts: { type: String, default: '' },
      openQuestions: { type: String, default: '' },
      keySources: {
        type: [
          {
            id: { type: String, default: '' },
            title: { type: String, default: '' },
            year: { type: Number, default: null },
            url: { type: String, default: '' }
          }
        ],
        default: []
      },
      version: { type: Number, default: 0 }
    },
    title: { type: String, default: '' },
    queryHistory: {
      type: [String],
      default: []
    },
    cachedSourceIds: [String],
    messageCount: { type: Number, default: 0 },
    uploadedDocs: {
      type: [
        {
          doc_id: { type: String, required: true },
          filename: { type: String, required: true },
          document_type: {
            type: String,
            enum: ['lab_report', 'research_paper', 'prescription', 'clinical_note', 'radiology_report', 'unknown'],
            default: 'unknown'
          },
          structured_summary: { type: String, default: '' },
          abnormal_findings: { type: [mongoose.Schema.Types.Mixed], default: [] },
          has_abnormal_findings: { type: Boolean, default: false },
          total_chunks: { type: Number, default: 0 },
          uploaded_at: { type: Date, default: Date.now }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

sessionSchema.index({ updatedAt: -1 });
sessionSchema.index({ createdAt: -1 });
sessionSchema.index({ disease: 1, updatedAt: -1 });
sessionSchema.index({ 'uploadedDocs.doc_id': 1 });

sessionSchema.pre('save', function onPreSave(next) {
  if (!this.title) {
    this.title = `${this.disease}${this.intent ? ` - ${this.intent}` : ''}`;
  }

  next();
});

export default mongoose.model('Session', sessionSchema);
