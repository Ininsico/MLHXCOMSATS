import { useEffect, useState } from 'react'
import Timetable from '../../components/Timetable'
import { api } from '../../lib/api'
import { SLOT_TIMES } from '../../lib/themes'

function formatDay(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export default function DoctorTimetablePage() {
  const [days, setDays] = useState([])
  const [state, setState] = useState('loading')
  const [range, setRange] = useState(7)

  useEffect(() => {
    let cancelled = false

    api.doctor
      .timetable(range)
      .then((data) => {
        if (cancelled) return
        setDays(data?.days ?? [])
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [range])

  const rows = days.map((day) => ({
    key: day.date,
    label: formatDay(day.date),
    subtitle: `${day.items.length} booked`,
    slots: Object.fromEntries(
      day.items.map((item) => [
        item.time,
        {
          label: item.patientName,
          title: `${item.patientName} — ${item.reason || 'appointment'} (${item.status})`,
          muted: item.status === 'completed',
        },
      ]),
    ),
  }))

  const total = days.reduce((sum, day) => sum + day.items.length, 0)

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Schedule</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink">My timetable</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-mist">
            Every slot booked with you, day by day. Slots run 09:00 to 17:00.
          </p>
        </div>

        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {[7, 14].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              aria-pressed={range === option}
              className={`rounded-full px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                range === option ? 'bg-white text-ink shadow-soft' : 'text-mist hover:text-ink'
              }`}
            >
              {option} days
            </button>
          ))}
        </div>
      </header>

      {state === 'loading' ? (
        <p className="mt-8 text-sm text-mist">Loading your timetable…</p>
      ) : null}
      {state === 'error' ? (
        <p className="mt-8 text-sm text-danger">Couldn't load your timetable right now.</p>
      ) : null}

      {state === 'ready' ? (
        <>
          <p className="mt-6 text-sm text-mist">
            {total} appointment{total === 1 ? '' : 's'} in the next {range} days
          </p>
          <div className="mt-4">
            <Timetable
              rows={rows}
              columns={SLOT_TIMES}
              rowHeader="Day"
              emptyLabel="No appointments in this range yet."
            />
          </div>
        </>
      ) : null}
    </>
  )
}
