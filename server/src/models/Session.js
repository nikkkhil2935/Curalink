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
      sex: {
        type: String,
        enum: ['Male', 'Female', 'Other', null],
        default: null
      }
    },
    title: { type: String, default: '' },
    queryHistory: [String],
    cachedSourceIds: [String],
    messageCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

sessionSchema.pre('save', function onPreSave(next) {
  if (!this.title) {
    this.title = `${this.disease}${this.intent ? ` - ${this.intent}` : ''}`;
  }

  next();
});

export default mongoose.model('Session', sessionSchema);
