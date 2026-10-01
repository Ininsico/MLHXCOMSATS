import { FLAG_LABELS, FLAG_STYLES, formatRange } from '../lib/lab'

export default function LabResultsTable({ results }) {
  if (!results?.length) return null

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="border-b border-line">
          <tr>
            {['Parameter', 'Result', 'Reference', 'Flag'].map((heading) => (
              <th
                key={heading}
                className="py-2 text-xs font-semibold uppercase tracking-wide text-mist"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((row) => (
            <tr key={row.parameter} className="border-b border-line last:border-0">
              <td className="py-2 font-medium text-ink">{row.parameter}</td>
              <td className="py-2 text-ink">
                {row.value} <span className="text-xs text-mist">{row.unit}</span>
              </td>
              <td className="py-2 text-xs text-mist">{formatRange(row)}</td>
              <td
                className={`py-2 text-xs font-semibold uppercase ${
                  FLAG_STYLES[row.flag] ?? FLAG_STYLES.unknown
                }`}
              >
                {FLAG_LABELS[row.flag] ?? row.flag}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
