import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ShieldCheck, ShieldX } from 'lucide-react'
import { api } from '../../lib/api'

/** Public verification page — anyone holding the code can confirm the record. */
export default function VerifyVaccinationPage() {
  const { code } = useParams()
  const [record, setRecord] = useState(null)
  const [state, setState] = useState('loading')

  useEffect(() => {
    let cancelled = false

    api.patients
      .verifyVaccination(code)
      .then((data) => {
        if (cancelled) return
        setRecord(data)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('missing')
      })

    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <main className="grid min-h-screen place-items-center bg-surface px-4">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-8 shadow-soft">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-700">Aurora verification</p>

        {state === 'loading' ? <p className="mt-4 text-sm text-mist">Checking the code…</p> : null}

        {state === 'missing' ? (
          <>
            <h1 className="mt-3 flex items-center gap-3 text-2xl font-extrabold text-ink">
              <ShieldX size={24} className="text-danger" />
              No record found
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-body">
              That code does not match any vaccination record on Aurora. Check it with the person
              who gave you the card.
            </p>
          </>
        ) : null}

        {state === 'ready' && record ? (
          <>
            <h1 className="mt-3 flex items-center gap-3 text-2xl font-extrabold text-ink">
              <ShieldCheck size={24} className="text-brand-600" />
              Verified record
            </h1>

            <dl className="mt-6 space-y-3">
              {[
                ['Name', record.patientName],
                ['Vaccine', `${record.vaccine} — dose ${record.doseNumber}`],
                ['Given on', new Date(record.administeredAt).toLocaleDateString()],
                ['Given by', record.administeredBy || 'not recorded'],
                ['Where', record.hospital?.name ? `${record.hospital.name}, ${record.hospital.city ?? ''}` : 'not recorded'],
                ['Code', record.code],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-line pb-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-mist">{label}</dt>
                  <dd className="text-right text-sm font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>

            <p className="mt-5 text-xs leading-relaxed text-mist">
              This confirms the record exists in Aurora and has not been altered. It is not a
              medical opinion.
            </p>
          </>
        ) : null}

        <Link to="/" className="mt-6 inline-flex text-xs font-semibold text-brand-700 hover:text-brand-800">
          Back to Aurora
        </Link>
      </div>
    </main>
  )
}
