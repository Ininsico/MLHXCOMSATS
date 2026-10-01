import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Brain, Loader2, Send, ShieldAlert, Sparkles, Trash2 } from 'lucide-react'
import { api } from '../../lib/api'

const ACCENTS = {
  brand: 'bg-brand-50 text-brand-700',
  danger: 'bg-danger/10 text-danger',
  sunrise: 'bg-brand-100 text-brand-800',
  rose: 'bg-brand-50 text-brand-800',
  midnight: 'bg-brand-800 text-white',
}

function accentClass(accent) {
  return ACCENTS[accent] ?? ACCENTS.brand
}

export default function AuroraAiPage({ mode = 'doctors' }) {
  const therapyOnly = mode === 'therapy'
  const [personas, setPersonas] = useState([])
  const [persona, setPersona] = useState(null)
  const [sessionId, setSessionId] = useState(null)
  const [messages, setMessages] = useState([])
  const [memories, setMemories] = useState([])
  const [recalled, setRecalled] = useState([])
  const [crisis, setCrisis] = useState(false)
  const [text, setText] = useState('')
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    api.aurora
      .personas()
      .then((data) => {
        if (cancelled) return
        setPersonas(data)
        if (therapyOnly) setPersona(data.find((entry) => entry.id === 'therapy') ?? data[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setError('Aurora could not load its assistants.')
      })

    return () => {
      cancelled = true
    }
  }, [therapyOnly])

  useEffect(() => {
    if (!persona) return

    let cancelled = false

    Promise.all([api.aurora.memories(persona.id), api.aurora.sessions(persona.id)])
      .then(([memoryList, sessions]) => {
        if (cancelled) return
        setMemories(memoryList)
        const latest = sessions[0]
        if (latest) {
          setSessionId(latest.id)
          api.aurora
            .session(latest.id)
            .then((session) => {
              if (!cancelled) setMessages(session.messages ?? [])
            })
            .catch(() => {})
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [persona])

  useEffect(() => {
    const node = scrollRef.current
    if (!node) return

    node.scrollTo({ top: node.scrollHeight, behavior: 'smooth' })
  }, [messages, state])

  const send = useCallback(
    async (value) => {
      const message = value.trim()
      if (!message || !persona || state === 'thinking') return

      setError('')
      setText('')
      setMessages((current) => [...current, { role: 'user', text: message }])
      setState('thinking')

      try {
        const data = await api.aurora.chat({ persona: persona.id, sessionId, text: message })

        setSessionId(data.sessionId)
        setMessages((current) => [...current, { role: 'aurora', text: data.reply, memory: data.memory }])
        setRecalled(data.recalled ?? [])
        setCrisis(Boolean(data.crisis))
        setState('idle')

        if (data.memory) {
          api.aurora
            .memories(persona.id)
            .then(setMemories)
            .catch(() => {})
        }
      } catch (err) {
        setState('idle')
        setError(err.message || 'Aurora could not answer just now.')
      }
    },
    [persona, sessionId, state],
  )

  async function forget(id) {
    try {
      await api.aurora.forgetMemory(id)
      setMemories((current) => current.filter((memory) => memory.id !== id))
    } catch {
      setError('That memory could not be removed.')
    }
  }

  if (!persona) {
    return (
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-700">
            Included with Aurora
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">AI doctors, free for every patient</h1>
          <p className="mt-2 max-w-2xl text-sm text-body">
            Aurora runs its own assistants on our servers — no booking, no waiting room, no queue.
            Pick a specialty to talk, and Aurora remembers your history for next time.
          </p>
        </header>

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {personas.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setPersona(entry)}
              className="rounded-2xl border border-line bg-white p-6 text-left shadow-soft transition duration-300 hover:-translate-y-1 hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
            >
              <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${accentClass(entry.accent)}`}>
                <Sparkles size={18} />
              </span>
              <h2 className="mt-4 text-base font-semibold text-ink">{entry.name}</h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                {entry.specialty}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-body">{entry.blurb}</p>
            </button>
          ))}
        </div>

        {error ? <p className="mt-6 text-sm font-medium text-danger">{error}</p> : null}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-8rem)] w-full flex-col overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className={`inline-flex h-11 w-11 items-center justify-center rounded-xl ${accentClass(persona.accent)}`}>
            <Brain size={20} />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-ink">{persona.name}</h1>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
              {persona.specialty} · AI assistant
            </p>
          </div>
        </div>

        {!therapyOnly ? (
          <button
            type="button"
            onClick={() => {
              setPersona(null)
              setMessages([])
              setSessionId(null)
              setRecalled([])
              setCrisis(false)
            }}
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm font-semibold text-body transition-colors hover:border-brand-300 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
          >
            Switch assistant
          </button>
        ) : null}
      </header>

      <div className="mt-6 grid min-h-0 flex-1 gap-6 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="flex h-[70dvh] min-h-0 flex-col rounded-2xl border border-line bg-white shadow-soft lg:h-auto">
          <div ref={scrollRef} className="scrollbar-none min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
            {!messages.length ? (
              <div>
                <p className="text-sm text-body">{persona.blurb}</p>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-mist">
                  Try one of these
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(persona.starters ?? []).map((starter) => (
                    <button
                      key={starter}
                      type="button"
                      onClick={() => send(starter)}
                      className="rounded-full border border-line px-4 py-2 text-xs font-medium text-body transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div
                key={`${message.at ?? index}-${index}`}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'bg-brand-700 text-white'
                      : 'border border-line bg-surface text-body'
                  }`}
                >
                  {message.text}
                  {message.memory ? (
                    <p className="mt-2 border-t border-line pt-2 text-xs text-mist">
                      remembered: {message.memory}
                    </p>
                  ) : null}
                </div>
              </div>
            ))}

            {state === 'thinking' ? (
              <div className="flex justify-start">
                <span className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-mist">
                  <Loader2 size={14} className="animate-spin" />
                  {persona.name} is thinking…
                </span>
              </div>
            ) : null}
          </div>

          {crisis ? (
            <div className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-danger/40 bg-danger/5 px-4 py-3">
              <ShieldAlert size={18} className="mt-0.5 shrink-0 text-danger" />
              <p className="text-sm text-body">
                A red-flag alert has been sent to your hospital. If you are in immediate danger,
                contact your local emergency number now.
              </p>
            </div>
          ) : null}

          {error ? <p className="mx-6 mb-3 text-sm font-medium text-danger">{error}</p> : null}

          {recalled.length ? (
            <p className="mx-6 mb-3 text-xs text-mist">
              Using {recalled.length} {recalled.length === 1 ? 'memory' : 'memories'} from your history
            </p>
          ) : null}

          <form
            onSubmit={(event) => {
              event.preventDefault()
              send(text)
            }}
            className="flex items-center gap-3 border-t border-line p-4"
          >
            <label htmlFor="aurora-message" className="sr-only">
              Message {persona.name}
            </label>
            <input
              id="aurora-message"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Talk to ${persona.name}…`}
              className="h-11 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-mist focus:border-brand-600 focus:ring-2 focus:ring-brand-600/30"
            />
            <button
              type="submit"
              disabled={state === 'thinking' || text.trim().length < 2}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-brand-700 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              <Send size={14} />
              Send
            </button>
          </form>

          <p className="border-t border-line px-4 py-3 text-xs text-mist">
            Aurora is an AI assistant, not a doctor — it cannot diagnose or prescribe. In an
            emergency, contact your local emergency services.
          </p>
        </section>

        <aside className="scrollbar-none space-y-4 lg:min-h-0 lg:overflow-y-auto">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="text-sm font-semibold text-ink">What Aurora remembers</h2>
            <p className="mt-1 text-xs text-mist">
              Notes from your own conversations, used only to help you next time.
            </p>

            {!memories.length ? (
              <p className="mt-4 rounded-xl bg-surface px-3 py-6 text-xs text-mist">
                Nothing yet — memories appear as you talk.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {memories.slice(0, 10).map((memory) => (
                  <li
                    key={memory.id}
                    className="group flex items-start justify-between gap-2 rounded-xl bg-surface px-3 py-2"
                  >
                    <span className="text-xs leading-relaxed text-body">{memory.text}</span>
                    <button
                      type="button"
                      onClick={() => forget(memory.id)}
                      aria-label="Forget this memory"
                      className="mt-0.5 shrink-0 rounded p-1 text-mist transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="text-sm font-semibold text-ink">Your AI doctors</h2>
            <ul className="mt-3 space-y-2">
              {personas.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPersona(entry)
                      setMessages([])
                      setSessionId(null)
                      setRecalled([])
                      setCrisis(false)
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 ${
                      entry.id === persona.id
                        ? 'bg-brand-50 text-brand-800'
                        : 'text-body hover:bg-surface hover:text-ink'
                    }`}
                  >
                    {entry.name}
                    <span className="mt-0.5 block text-[11px] font-medium text-mist">
                      {entry.specialty}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <Link
              to="/dashboard/appointments"
              className="mt-4 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              Need a human doctor? Book an appointment →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  )
}
