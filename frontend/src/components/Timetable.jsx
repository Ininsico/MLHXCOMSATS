import { SLOT_TIMES } from '../lib/themes'

export default function Timetable({
  rows = [],
  columns = SLOT_TIMES,
  rowHeader = 'Slot',
  emptyLabel = 'Nothing scheduled.',
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-soft">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead className="border-b border-line bg-surface">
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-10 bg-surface px-4 py-3 text-xs font-semibold uppercase tracking-wide text-mist"
            >
              {rowHeader}
            </th>
            {columns.map((time) => (
              <th
                key={time}
                scope="col"
                className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-mist"
              >
                {time}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length ? (
            rows.map((row) => (
              <tr key={row.key} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 text-left">
                  <span className="block text-sm font-semibold text-ink">{row.label}</span>
                  {row.subtitle ? (
                    <span className="block text-xs text-mist">{row.subtitle}</span>
                  ) : null}
                </th>

                {columns.map((time) => {
                  const slot = row.slots[time]

                  return (
                    <td key={time} className="px-2 py-2 align-top">
                      {slot ? (
                        <span
                          title={slot.title}
                          className={`block truncate rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
                            slot.muted
                              ? 'bg-surface text-mist'
                              : 'bg-brand-50 text-brand-800'
                          }`}
                        >
                          {slot.label}
                        </span>
                      ) : (
                        <span className="block text-center text-xs text-line">·</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={columns.length + 1} className="px-4 py-8 text-sm text-mist">
                {emptyLabel}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
