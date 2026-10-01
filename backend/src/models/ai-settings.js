const { Schema, model } = require('mongoose')

const aiSettingsSchema = new Schema(
  {
    singleton: { type: String, default: 'ai', unique: true },
    enabled: { type: Boolean, default: true },
    departments: {
      type: [
        {
          _id: false,
          name: { type: String, trim: true, maxlength: 80 },
          enabled: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    maxTokens: { type: Number, min: 64, max: 2048, default: 512 },
    temperature: { type: Number, min: 0, max: 2, default: 0.2 },
    timeoutSeconds: { type: Number, min: 30, max: 600, default: 180 },
  },
  { timestamps: true },
)

aiSettingsSchema.statics.load = function load() {
  return this.findOneAndUpdate(
    { singleton: 'ai' },
    { $setOnInsert: { singleton: 'ai' } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  )
}

aiSettingsSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('AiSettings', aiSettingsSchema)
