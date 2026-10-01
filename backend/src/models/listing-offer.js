const { Schema, model } = require('mongoose')

/** An offer on a listing. The seller accepts (which reserves it) or declines. */
const listingOfferSchema = new Schema(
  {
    listing: { type: Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
    buyer: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    buyerName: { type: String, trim: true, maxlength: 120, default: '' },
    amount: { type: Number, required: true, min: 0 },
    message: { type: String, trim: true, maxlength: 400, default: '' },
    status: { type: String, enum: ['pending', 'accepted', 'declined', 'withdrawn'], default: 'pending', index: true },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

listingOfferSchema.index({ listing: 1, buyer: 1, status: 1 })

listingOfferSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('ListingOffer', listingOfferSchema)
