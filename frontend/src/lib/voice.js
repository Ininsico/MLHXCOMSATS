/**
 * Voice layer for the booking agent.
 *
 * TTS: kitten-tts-js (ONNX/WASM, 8 voices, runs locally in the browser) with the
 *      Web Speech API as a guaranteed fallback.
 * STT: the browser's speech recognition when available; the Express backend keeps
 *      a `@micdrop/whisper` hook for server-side transcription (no cloud calls).
 */

export const VOICES = ['Bella', 'Jasper', 'Luna', 'Bruno', 'Rosie', 'Hugo', 'Kiki', 'Leo']

let ttsModule = null

async function loadTts() {
  if (ttsModule !== null) return ttsModule

  try {
    const module = await import('kitten-tts-js')
    ttsModule = module?.default ?? module
  } catch {
    ttsModule = false
  }

  return ttsModule
}

async function toBlob(audio) {
  if (!audio) return null
  if (audio instanceof Blob) return audio
  if (typeof audio.toBlob === 'function') {
    const value = await audio.toBlob()
    return value instanceof Blob ? value : null
  }
  if (audio.audio instanceof Blob) return audio.audio
  if (audio.data instanceof Blob) return audio.data
  if (audio.buffer instanceof ArrayBuffer) return new Blob([audio.buffer], { type: 'audio/wav' })
  return null
}

async function playBlob(blob) {
  const url = URL.createObjectURL(blob)

  try {
    const element = new Audio(url)
    await element.play()
    await new Promise((resolve) => {
      element.onended = resolve
      element.onerror = resolve
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

function speakWithBrowser(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 1
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
  return true
}

/** Speak a sentence out loud, locally. Returns which engine was used. */
export async function speak(text, voiceName = 'Bella') {
  const value = String(text ?? '').trim()

  if (!value) return { spoken: false, engine: 'none' }

  const tts = await loadTts()

  if (tts) {
    try {
      const generator = tts.KittenTTS ?? tts.default ?? tts
      const audio = generator?.generate
        ? await generator.generate(value, { voice: voiceName })
        : typeof generator === 'function'
          ? await generator(value, { voice: voiceName })
          : null

      const blob = await toBlob(audio)

      if (blob) {
        await playBlob(blob)
        return { spoken: true, engine: 'kitten-tts-js', voice: voiceName }
      }
    } catch {
      /* fall through to the browser voice */
    }
  }

  return speakWithBrowser(value)
    ? { spoken: true, engine: 'speechSynthesis', voice: 'system' }
    : { spoken: false, engine: 'none' }
}

export function ttsAvailable() {
  return Boolean(ttsModule) || (typeof window !== 'undefined' && Boolean(window.speechSynthesis))
}

function RecognitionClass() {
  if (typeof window === 'undefined') return null

  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null
}

export function sttAvailable() {
  return Boolean(RecognitionClass()) || recorderSupported()
}

export function recorderSupported() {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia &&
      typeof MediaRecorder !== 'undefined',
  )
}

/** Record a question in the browser; the backend transcribes it with Whisper. */
export function createRecorder() {
  if (!recorderSupported()) return null

  let recorder = null
  let stream = null
  let chunks = []

  return {
    async start() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunks = []

      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((type) =>
        MediaRecorder.isTypeSupported(type),
      )

      recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined)
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data)
      }
      recorder.start()
    },
    stop() {
      return new Promise((resolve) => {
        if (!recorder || recorder.state === 'inactive') {
          resolve(null)
          return
        }

        recorder.onstop = () => {
          stream?.getTracks().forEach((track) => track.stop())
          resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }

        recorder.stop()
      })
    },
    cancel() {
      try {
        recorder?.stop()
      } catch {
        /* already stopped */
      }
      stream?.getTracks().forEach((track) => track.stop())
    },
  }
}

/** Send a recording to the backend and get the transcript back. */
export async function transcribeBlob(blob) {
  const response = await fetch('/api/voice/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'audio/webm' },
    body: blob,
    credentials: 'include',
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'I could not transcribe that recording.')
  }

  return payload.data.text
}

/**
 * Create a one-shot listener. `onTranscript(text, isFinal)` fires as the browser
 * recognises speech; calling `stop()` ends the turn.
 */
export function createListener({ onTranscript, onEnd, onError }) {
  const Recognition = RecognitionClass()

  if (!Recognition) return null

  const recognition = new Recognition()
  recognition.lang = 'en-US'
  recognition.interimResults = true
  recognition.continuous = false
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    let interim = ''
    let final = ''

    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const result = event.results[index]
      if (result.isFinal) final += result[0].transcript
      else interim += result[0].transcript
    }

    onTranscript?.((final || interim).trim(), Boolean(final))
  }

  recognition.onerror = (event) => onError?.(event.error ?? 'speech-error')
  recognition.onend = () => onEnd?.()

  return {
    start: () => {
      try {
        recognition.start()
      } catch {
        /* already started */
      }
    },
    stop: () => {
      try {
        recognition.stop()
      } catch {
        /* already stopped */
      }
    },
  }
}
