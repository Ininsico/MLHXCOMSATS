/**
 * Every document leaves the API with a stable `id`.
 *
 * Mongoose does not add the `id` virtual when a schema supplies its own `toJSON`
 * transform — so responses carried only `_id`, and every client that read `.id`
 * got undefined (which silently broke URL building and id comparisons across the
 * app). Rather than remembering to add it in twenty-five model files, the wrap
 * happens once at boot, after every model is loaded.
 */

const mongoose = require('mongoose')

const MARKER = '__auroraIds'
let applied = false

function ensureIds() {
  if (applied) return

  for (const name of mongoose.modelNames()) {
    const schema = mongoose.model(name).schema
    const existing = schema.options?.toJSON ?? {}

    if (existing[MARKER]) continue

    const original = existing.transform

    schema.set('toJSON', {
      ...existing,
      [MARKER]: true,
      transform: (doc, ret, options) => {
        const output = original ? original(doc, ret, options) : ret

        if (output && output.id === undefined && output._id !== undefined) {
          output.id = String(output._id)
        }

        return output
      },
    })
  }

  applied = true
}

module.exports = { ensureIds }
