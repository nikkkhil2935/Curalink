import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: {
      city: { type: String, default: '' },
      country: { type: String, default: '' },
      coordinates: {
        type: [Number],
        default: []
      }
    },
    demographics: {
      age: { type: Number, default: null },
      sex: {
        type: String,
        enum: ['Male', 'Female', 'Other', null],
        default: null
      }
    },
    preferences: {
      units: { type: String, default: 'metric' },
      language: { type: String, default: 'en' }
    }
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
