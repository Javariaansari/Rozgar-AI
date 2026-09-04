import { useEffect, useState } from 'react'
import { requireAdminPage } from '@/lib/requireAdmin'
import AdminLayout from '@/components/AdminLayout'
import {
  ChartCard,
  BarList,
  DonutChart,
  ProgressRing,
  CHART_COLORS,
} from '@/components/AdminCharts'

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-lg shadow p-5">
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  )
}

function StatusBadge({ status }) {
  const styles = {
    open: 'bg-blue-100 text-blue-800',
    under_review: 'bg-yellow-100 text-yellow-800',
    resolved: 'bg-green-100 text-green-800',
    rejected: 'bg-gray-100 text-gray-800',
  }
  const label = status === 'under_review' ? 'under review' : status
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {label}
    </span>
  )
}

function humanizeLabel(key) {
  return key === 'under_review' ? 'under review' : key.replace(/_/g, ' ')
}

function buildStatusItems(counts, keys) {
  return keys
    .map((key) => ({
      label: humanizeLabel(key),
      value: counts[key] || 0,
      color: CHART_COLORS[key] || CHART_COLORS.other,
    }))
    .filter((item) => item.value > 0)
}

function buildStarHistogram(ratings) {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  ratings.forEach((r) => {
    if (counts[r.stars] !== undefined) counts[r.stars]++
  })
  return Object.entries(counts)
    .reverse()
    .map(([stars, value]) => ({
      label: `${stars} star${stars === '1' ? '' : 's'}`,
      value,
      color: CHART_COLORS.completed,
    }))
}

export default function AdminDashboard({ profile }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function fetchStats() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/stats')
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load stats')
      setStats(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <AdminLayout
      profile={profile}
      title="Overview"
      subtitle="System monitoring at a glance"
      actions={
        <button
          onClick={fetchStats}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      }
    >
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      {!stats && loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : stats ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={stats.users.total} />
            <StatCard label="Workers" value={stats.users.worker} />
            <StatCard label="Customers" value={stats.users.customer} />
            <StatCard label="Banned" value={stats.users.banned} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Open Jobs" value={stats.jobs.open} />
            <StatCard label="In Progress" value={stats.jobs.in_progress} />
            <StatCard label="Completed" value={stats.jobs.completed} />
            <StatCard label="Flagged Jobs" value={stats.jobs.flagged} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Open Disputes" value={stats.disputes.open} />
            <StatCard label="Under Review" value={stats.disputes.under_review} />
            <StatCard label="CNIC Pending" value={stats.workers.cnic_pending} />
            <StatCard label="CNIC Verified" value={stats.workers.cnic_verified} />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <ChartCard
              title="Jobs by Status"
              footer={stats.jobs.flagged > 0 ? `${stats.jobs.flagged} job(s) flagged` : null}
            >
              <BarList
                items={buildStatusItems(stats.jobs, ['open', 'in_progress', 'completed', 'cancelled'])}
              />
            </ChartCard>

            <ChartCard
              title="Users by Role"
              footer={stats.users.banned > 0 ? `${stats.users.banned} user(s) banned` : null}
            >
              <DonutChart
                segments={buildStatusItems(stats.users, ['worker', 'customer', 'admin'])}
                total={stats.users.total}
                centerLabel="Total"
                centerValue={stats.users.total}
              />
            </ChartCard>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ChartCard title="Disputes by Status">
              <BarList
                items={buildStatusItems(stats.disputes, [
                  'open',
                  'under_review',
                  'resolved',
                  'rejected',
                ])}
              />
            </ChartCard>

            <ChartCard title="CNIC Verification">
              <DonutChart
                segments={[
                  { label: 'Verified', value: stats.workers.cnic_verified, color: CHART_COLORS.verified },
                  { label: 'Pending', value: stats.workers.cnic_pending, color: CHART_COLORS.pending },
                ]}
                centerLabel="Verified"
                centerValue={`${
                  stats.workers.cnic_verified + stats.workers.cnic_pending > 0
                    ? Math.round(
                        (stats.workers.cnic_verified /
                          (stats.workers.cnic_verified + stats.workers.cnic_pending)) *
                          100
                      )
                    : 0
                }%`}
              />
            </ChartCard>

            <ChartCard title="Job Completion Rate">
              <ProgressRing value={stats.jobs.completed} total={stats.jobs.total} label="Completed" />
            </ChartCard>
          </div>

          {stats.recent_ratings.length > 0 && (
            <ChartCard title="Last 10 Ratings Spread">
              <BarList items={buildStarHistogram(stats.recent_ratings)} />
            </ChartCard>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <section className="bg-white rounded-lg shadow p-5">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                Recent Ratings & Reviews
              </h2>
              {stats.recent_ratings.length === 0 ? (
                <p className="text-sm text-gray-500">No ratings yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {stats.recent_ratings.map((r) => (
                    <div key={r.id} className="bg-gray-50 border border-gray-200 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-yellow-500 text-sm">{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</div>
                        <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {r.from_name} → {r.to_name}
                      </div>
                      <div className="text-xs text-gray-500">{r.job_title}</div>
                      {r.review_text && <p className="text-sm text-gray-800 mt-1">{r.review_text}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white rounded-lg shadow p-5">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                Recent Disputes
              </h2>
              {stats.recent_disputes.length === 0 ? (
                <p className="text-sm text-gray-500">No disputes yet.</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {stats.recent_disputes.map((d) => (
                    <div key={d.id} className="bg-gray-50 border border-gray-200 rounded p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">{d.job?.title || 'Unknown job'}</span>
                        <StatusBadge status={d.status} />
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        Raised by {d.raiser?.name || d.raiser?.email || 'Unknown'}
                      </div>
                      <p className="text-sm text-gray-800 mt-1 line-clamp-2">{d.reason}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </AdminLayout>
  )
}

export async function getServerSideProps(context) {
  const guard = await requireAdminPage(context)
  if (guard.redirect) return { redirect: guard.redirect }
  return { props: { profile: guard.profile } }
}
