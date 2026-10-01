const { Schema, model } = require('mongoose')
const { CATEGORIES, CONDITIONS } = require('../lib/marketplace')

const listingSchema = new Schema(
  {
    seller: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 800 },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    condition: { type: String, enum: CONDITIONS, default: 'used', index: true },
    price: { type: Number, min: 0, required: true },
    images: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['available', 'reserved', 'sold'],
      default: 'available',
      index: true,
    },
    buyer: { type: Schema.Types.ObjectId, ref: 'Hospital', default: null, index: true },
    reservedAt: { type: Date, default: null },
    soldAt: { type: Date, default: null },
    soldPrice: { type: Number, min: 0, default: null },
    views: { type: Number, min: 0, default: 0 },
    offerCount: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
)

listingSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('Listing', listingSchema)
