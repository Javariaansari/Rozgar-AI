export const CHART_COLORS = {
  open: '#3b82f6',
  in_progress: '#eab308',
  completed: '#22c55e',
  cancelled: '#9ca3af',
  rejected: '#9ca3af',
  under_review: '#eab308',
  resolved: '#22c55e',
  worker: '#a855f7',
  customer: '#3b82f6',
  admin: '#6b7280',
  verified: '#22c55e',
  pending: '#f59e0b',
  other: '#d1d5db',
  flagged: '#ef4444',
  banned: '#ef4444',
}

export function ChartCard({ title, footer, children }) {
  return (
    <section className="bg-white rounded-lg shadow p-5">
      <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
        {title}
      </h2>
      {children}
      {footer && <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-500">{footer}</div>}
    </section>
  )
}

export function BarList({ items }) {
  const max = Math.max(...items.map((i) => i.value), 0)
  if (max === 0) {
    return <p className="text-sm text-gray-500">No data yet.</p>
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const pct = (item.value / max) * 100
        return (
          <div key={i}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500 capitalize">{item.label}</span>
              <span className="text-sm font-medium text-gray-900">{item.value}</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, backgroundColor: item.color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DonutChart({ segments, total, centerLabel, centerValue }) {
  const safeTotal = total || segments.reduce((sum, s) => sum + s.value, 0)
  let offset = 0

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-32 h-32 shrink-0">
        <svg
          viewBox="0 0 42 42"
          className="w-full h-full"
          role="img"
          aria-label={`${centerLabel || 'Distribution'} chart`}
        >
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <g transform="rotate(-90 21 21)">
            {segments.map((s, i) => {
              const pct = safeTotal ? (s.value / safeTotal) * 100 : 0
              const dash = `${pct} ${100 - pct}`
              const currentOffset = offset
              offset -= pct
              return (
                <circle
                  key={i}
                  cx="21"
                  cy="21"
                  r="15.9155"
                  fill="none"
                  stroke={s.color}
                  strokeWidth="4"
                  strokeDasharray={dash}
                  strokeDashoffset={currentOffset}
                >
                  <title>{`${s.label}: ${s.value}`}</title>
                </circle>
              )
            })}
          </g>
        </svg>
        {centerLabel && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-xl font-bold text-gray-900">{centerValue}</div>
              <div className="text-xs text-gray-500">{centerLabel}</div>
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 space-y-2">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-gray-600">{s.label}</span>
            </div>
            <span className="font-medium text-gray-900">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProgressRing({ value, total, label }) {
  const pct = total ? Math.round((value / total) * 100) : 0

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg
          viewBox="0 0 42 42"
          className="w-full h-full"
          role="img"
          aria-label={`${label}: ${pct}%`}
        >
          <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="4" />
          <g transform="rotate(-90 21 21)">
            <circle
              cx="21"
              cy="21"
              r="15.9155"
              fill="none"
              stroke="#22c55e"
              strokeWidth="4"
              strokeDasharray={`${pct} ${100 - pct}`}
            />
          </g>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{pct}%</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-600">
        {value} of {total}
      </div>
    </div>
  )
}
