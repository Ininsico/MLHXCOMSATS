const { Schema, model } = require('mongoose')

/** Service history for hospital equipment — the other half of the marketplace. */
const equipmentLogSchema = new Schema(
  {
    hospital: { type: Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
    inventoryItem: { type: Schema.Types.ObjectId, ref: 'InventoryItem', default: null, index: true },
    itemName: { type: String, trim: true, maxlength: 120, default: '' },
    kind: {
      type: String,
      enum: ['service', 'repair', 'calibration', 'inspection', 'fault'],
      default: 'service',
    },
    performedBy: { type: String, trim: true, maxlength: 80, default: '' },
    performedAt: { type: Date, default: Date.now, index: true },
    outcome: { type: String, trim: true, maxlength: 300, default: '' },
    nextDueAt: { type: Date, default: null, index: true },
    cost: { type: Number, min: 0, default: 0 },
  },
  { timestamps: true },
)

equipmentLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('EquipmentLog', equipmentLogSchema)
