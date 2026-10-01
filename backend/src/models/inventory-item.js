const { Schema, model } = require('mongoose')

const movementSchema = new Schema(
  {
    type: { type: String, enum: ['in', 'out', 'adjust'], required: true },
    quantity: { type: Number, required: true },
    reason: { type: String, trim: true, maxlength: 120, default: '' },
    by: { type: String, trim: true, maxlength: 80, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
)

const inventoryItemSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    sku: { type: String, trim: true, uppercase: true, maxlength: 40, default: '' },
    category: { type: String, trim: true, maxlength: 60, default: 'General' },
    unit: { type: String, trim: true, maxlength: 20, default: 'unit' },
    quantity: { type: Number, min: 0, default: 0 },
    reorderLevel: { type: Number, min: 0, default: 0 },
    location: { type: String, trim: true, maxlength: 80, default: '' },
    movements: { type: [movementSchema], default: [] },
  },
  { timestamps: true },
)

inventoryItemSchema.index({ hospital: 1, name: 1 })

inventoryItemSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('InventoryItem', inventoryItemSchema)
