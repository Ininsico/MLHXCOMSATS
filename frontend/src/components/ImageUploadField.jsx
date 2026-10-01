import { useRef, useState } from 'react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { api } from '../lib/api'

const MAX_BYTES = 4 * 1024 * 1024
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('That file could not be read.'))
    reader.readAsDataURL(file)
  })
}

export default function ImageUploadField({ id, label, hint, value, onChange }) {
  const inputRef = useRef(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    setError('')

    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Use a PNG, JPG, or WebP image.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Keep the image under 4 MB.')
      return
    }

    setUploading(true)

    try {
      const dataUrl = await readAsDataUrl(file)
      const result = await api.uploads.image(dataUrl)
      onChange(result.url)
    } catch (err) {
      setError(err.message || 'The image could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <span className="text-sm font-semibold text-ink">{label}</span>

      <div className="mt-2 flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface">
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImagePlus size={20} className="text-mist" aria-hidden="true" />
          )}
        </div>

        <div className="flex flex-col items-start gap-2">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFile}
            className="hidden"
            tabIndex={-1}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-body transition duration-300 hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
            {uploading ? 'Uploading…' : value ? 'Replace image' : 'Upload image'}
          </button>

          {value ? (
            <button
              type="button"
              onClick={() => {
                setError('')
                onChange('')
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-mist transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              <Trash2 size={12} />
              Remove
            </button>
          ) : null}

          {hint ? <p className="text-xs text-mist">{hint}</p> : null}
        </div>
      </div>

      {error ? <p className="mt-2 text-xs font-medium text-danger">{error}</p> : null}
    </div>
  )
}
