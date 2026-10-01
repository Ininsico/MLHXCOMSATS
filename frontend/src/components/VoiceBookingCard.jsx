import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, Mic, MicOff, PhoneOff, Send, Volume2 } from 'lucide-react'
import { api } from '../lib/api'
import { createListener, createRecorder, speak, sttAvailable, transcribeBlob, ttsAvailable, VOICES } from '../lib/voice'

export default function VoiceBookingCard({ hospitalId, hospitalName }) {
  const [sessionId, setSessionId] = useState(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [reply, setReply] = useState('')
  const [options, setOptions] = useState([])
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [voice, setVoice] = useState('Bella')
  const [booked, setBooked] = useState(false)
  const listenerRef = useRef(null)
  const recorderRef = useRef(null)
  const busy = state === 'thinking'

  useEffect(() => {
    return () => {
      listenerRef.current?.stop()
      recorderRef.current?.cancel()
      window.speechSynthesis?.cancel()
    }
  }, [])

  async function sendTurn(message) {
    const value = message.trim()

    if (!value) return

    setError('')
    setTranscript(value)
    setState('thinking')

    try {
      const data = await api.voice.turn({
        sessionId,
        hospitalId,
        text: value,
        source: listenerRef.current ? 'voice' : 'text',
      })

      setSessionId(data.sessionId)
      setReply(data.reply)
      setOptions(data.options ?? [])
      setBooked(data.state === 'booked')
      setState('ready')

      if (data.reply) {
        await speak(data.reply, voice).catch(() => {})
      }
    } catch (err) {
      setError(err.message || 'The assistant could not answer.')
      setState('error')
    }
  }

  async function confirmOption(index) {
    setError('')
    setState('thinking')

    try {
      const data = await api.voice.confirm({ sessionId, optionIndex: index })
      setReply(data.reply)
      setOptions([])
      setBooked(true)
      setState('ready')
      await speak(data.reply, voice).catch(() => {})
    } catch (err) {
      setError(err.message || 'That slot could not be booked.')
      setState('error')
    }
  }

  async function endSession() {
    listenerRef.current?.stop()
    window.speechSynthesis?.cancel()

    try {
      if (sessionId) await api.voice.end({ sessionId })
    } catch {
      /* ending is best effort */
    }

    setSessionId(null)
    setOptions([])
    setReply('')
    setTranscript('')
    setBooked(false)
    setState('idle')
  }

  function toggleListening() {
    if (listening) {
      stopListening()
      return
    }

    const recorder = createRecorder()

    if (recorder) {
      recorderRef.current = recorder
      setError('')
      setListening(true)
      setTranscript('')

      recorder
        .start()
        .catch(() => {
          recorderRef.current = null
          setListening(false)
          setError('Microphone permission denied — type your request instead.')
        })

      return
    }

    const listener = createListener({
      onTranscript: (value, isFinal) => {
        setTranscript(value)
        if (isFinal) {
          setListening(false)
          sendTurn(value)
        }
      },
      onEnd: () => setListening(false),
      onError: (message) => {
        setListening(false)
        setError(message === 'not-allowed' ? 'Microphone permission denied — type instead.' : `Microphone error: ${message}`)
      },
    })

    if (!listener) {
      setError('This browser cannot record audio — type your request instead.')
      return
    }

    listenerRef.current = listener
    setError('')
    setListening(true)
    listener.start()
  }

  async function stopListening() {
    setListening(false)
    setState('thinking')

    try {
      const blob = await recorderRef.current?.stop()

      if (!blob || !blob.size) {
        setState('idle')
        setError('That recording was empty — try again.')
        return
      }

      const text = await transcribeBlob(blob)
      setTranscript(text)
      await sendTurn(text)
    } catch (err) {
      setState('idle')
      setError(err.message || 'Could not transcribe that recording.')
    } finally {
      recorderRef.current = null
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-6 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
          <Volume2 size={18} className="text-brand-700" />
          Book by talking
        </h2>

        <div className="flex items-center gap-2">
          <label htmlFor="voice-choice" className="text-xs font-semibold uppercase tracking-wide text-mist">
            Voice
          </label>
          <select
            id="voice-choice"
            value={voice}
            onChange={(event) => setVoice(event.target.value)}
            className="h-9 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-body outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
          >
            {VOICES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="mt-1 text-sm text-mist">
        {hospitalName ? `Booking with ${hospitalName}. ` : ''}
        Say what you need — <span className="italic">“I need to see a cardiologist next week”</span> — and
        the assistant offers real slots.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={toggleListening}
          disabled={busy || !sttAvailable()}
          className={`inline-flex h-11 items-center gap-2 rounded-full px-6 text-xs font-bold uppercase tracking-widest transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50 ${
            listening ? 'bg-danger text-white' : 'bg-brand-700 text-white hover:bg-brand-800'
          }`}
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : listening ? <MicOff size={15} /> : <Mic size={15} />}
          {listening ? 'Listening… tap to stop' : 'Tap to speak'}
        </button>

        {!sttAvailable() ? (
          <span className="text-xs text-mist">Speech recognition is unavailable here — use the text box.</span>
        ) : null}

        {sessionId ? (
          <button
            type="button"
            onClick={endSession}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-line px-5 text-xs font-bold uppercase tracking-widest text-body transition-colors hover:border-danger hover:text-danger"
          >
            <PhoneOff size={14} />
            End
          </button>
        ) : null}

        <span className="text-xs text-mist">
          {ttsAvailable() ? 'Local text-to-speech ready' : 'Browser voice fallback'}
        </span>
      </div>

      {transcript ? (
        <p className="mt-5 rounded-xl bg-surface px-4 py-3 text-sm text-body">
          <span className="font-semibold text-ink">You said:</span> {transcript}
        </p>
      ) : null}

      {state === 'thinking' ? <p className="mt-4 text-sm text-mist">Thinking…</p> : null}

      {reply ? (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <button
            type="button"
            onClick={() => speak(reply, voice).catch(() => {})}
            aria-label="Replay the assistant's reply"
            className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            <Volume2 size={14} />
          </button>
          <p className="text-sm leading-relaxed text-brand-800">{reply}</p>
        </div>
      ) : null}

      {options.length ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {options.map((option, index) => (
            <button
              key={`${option.date}-${option.time}`}
              type="button"
              onClick={() => confirmOption(index)}
              disabled={busy}
              className="inline-flex h-11 items-center rounded-lg border border-line px-5 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {index + 1}. {option.date} at {option.time} · {option.doctorName}
            </button>
          ))}
        </div>
      ) : null}

      {booked ? (
        <p className="mt-5 rounded-xl border border-brand-200 bg-white px-4 py-3 text-sm text-brand-800">
          Booked — it is already in your dashboard.{' '}
          <Link to="/dashboard/appointments" className="font-semibold text-brand-700 hover:text-brand-800">
            See your appointments
          </Link>
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm font-medium text-danger">{error}</p> : null}

      <form
        onSubmit={(event) => {
          event.preventDefault()
          const value = text
          setText('')
          sendTurn(value)
        }}
        className="mt-5 flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="voice-text" className="sr-only">
          Type your request instead
        </label>
        <input
          id="voice-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="…or type it here: “any cardiologist tomorrow morning”"
          className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
        />
        <button
          type="submit"
          disabled={busy || text.trim().length < 2}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-700 px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          <Send size={14} />
          Send
        </button>
      </form>
    </section>
  )
}
