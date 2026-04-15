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
    journal: String,
    citedByCount: Number,
    isOpenAccess: Boolean,
    status: String,
    statusColor: String,
    phase: String,
    studyType: String,
    eligibility: String,
    gender: String,
    minAge: String,
    maxAge: String,
    completionDate: String,
    isLocationRelevant: Boolean,
    locations: [String],
    contacts: [
      {
        name: String,
        email: String,
        phone: String
      }
    ],
    relevanceScore: Number,
    recencyScore: Number,
    locationScore: Number,
    sourceCredibility: Number,
    finalScore: Number,
    queryAssociations: [String],
    timesUsed: { type: Number, default: 0 },
    lastRelevanceScore: Number
  },
  { timestamps: true }
);

export default mongoose.model('SourceDoc', sourceDocSchema);
