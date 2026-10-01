const { Schema, model } = require('mongoose')

const reviewSchema = new Schema(
  {
    author: { type: String, required: true, trim: true, maxlength: 60 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false },
)

const hospitalSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    area: { type: String, required: true, trim: true, maxlength: 80 },
    address: { type: String, trim: true, maxlength: 200, default: '' },
    phone: { type: String, trim: true, maxlength: 30, default: '' },
    description: { type: String, trim: true, maxlength: 600, default: '' },
    specialties: { type: [String], default: [] },
    logoUrl: { type: String, trim: true, maxlength: 500, default: '' },
    photos: { type: [String], default: [] },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    reviewCount: { type: Number, min: 0, default: 0 },
    reviews: { type: [reviewSchema], default: [] },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'suspended'],
      default: 'pending',
      index: true,
    },
    subscription: {
      planId: { type: String, default: 'starter' },
      themeId: { type: String, default: 'classic' },
      status: { type: String, enum: ['none', 'active'], default: 'active' },
      startedAt: { type: Date, default: null },
      renewsAt: { type: Date, default: null },
    },
    verification: {
      status: {
        type: String,
        enum: ['unverified', 'pending', 'verified', 'rejected'],
        default: 'unverified',
        index: true,
      },
      documents: {
        type: [
          {
            label: { type: String, trim: true, maxlength: 80 },
            url: { type: String, trim: true, maxlength: 500 },
          },
        ],
        default: [],
      },
      submittedAt: { type: Date, default: null },
      reviewedAt: { type: Date, default: null },
      notes: { type: String, trim: true, maxlength: 300, default: '' },
    },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true, default: null },
  },
  { timestamps: true },
)

hospitalSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Hospital', hospitalSchema)
