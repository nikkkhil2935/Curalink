import mongoose from 'mongoose';

const sourceDocSchema = new mongoose.Schema(
  {
    _id: { type: String },
    type: { type: String, enum: ['publication', 'trial'], required: true },
    source: {
      type: String,
      enum: ['PubMed', 'OpenAlex', 'ClinicalTrials'],
      required: true
    },
    title: { type: String, required: true },
    abstract: { type: String, default: '' },
    authors: [String],
    year: Number,
    url: String,
    status: String,
    phase: String,
    eligibility: String,
    locations: [String],
    contacts: [
      {
        name: String,
        email: String,
        phone: String
      }
    ],
    queryAssociations: [String],
    timesUsed: { type: Number, default: 0 },
    lastRelevanceScore: Number
  },
  { timestamps: true }
);

export default mongoose.model('SourceDoc', sourceDocSchema);
