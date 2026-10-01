const { Schema, model } = require('mongoose')

const aiCacheSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    response: { type: Schema.Types.Mixed, required: true },
    modelVersion: { type: String, trim: true, maxlength: 120, default: '' },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true },
)

aiCacheSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v
    return ret
  },
})

module.exports = model('AiCache', aiCacheSchema)
