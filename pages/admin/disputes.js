import { useEffect, useState } from 'react'
import { requireAdminPage } from '@/lib/requireAdmin'
import AdminLayout from '@/components/AdminLayout'

const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'rejected', label: 'Rejected' },
]

const STATUS_BADGES = {
  open: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  rejected: 'bg-gray-100 text-gray-800',
}

export default function AdminDisputes({ profile }) {
  const [disputes, setDisputes] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [savingId, setSavingId] = useState('')

  async function fetchDisputes(pageNum = page) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      params.set('page', String(pageNum))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/disputes?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load disputes')
      setDisputes(data.disputes)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDisputes(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function saveDispute(d) {
    const note = d._resolution_note ?? d.resolution_note ?? ''
    if ((d._status === 'resolved' || d._status === 'rejected') && !note.trim()) {
      setError('Resolution note is required when resolving or rejecting')
      return
    }

    setSavingId(d.id)
    setError('')
    try {
      const res = await fetch(`/api/admin/disputes/${d.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: d._status, resolution_note: note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Update failed')
      await fetchDisputes(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId('')
    }
  }

  function updateField(d, field, value) {
    setDisputes((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, [field]: value } : x))
    )
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <AdminLayout profile={profile} title="Dispute Resolution" subtitle="Review and resolve user disputes">
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              status === tab.key
                ? 'bg-blue-50 text-blue-700'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && disputes.length === 0 ? (
        <p className="text-gray-500">Loading...</p>
      ) : disputes.length === 0 ? (
        <p className="text-gray-500">No disputes found.</p>
      ) : (
        <div className="space-y-4">
          {disputes.map((d) => (
            <div key={d.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold text-gray-900">{d.job?.title || 'Unknown job'}</div>
                  <div className="text-xs text-gray-500">
                    Job status:{' '}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGES[d.job?.status] || 'bg-gray-100 text-gray-800'}`}>
                      {d.job?.status || 'unknown'}
                    </span>
                  </div>
                </div>
                <div className="text-right sm:text-left">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_BADGES[d.status] || 'bg-gray-100 text-gray-800'}`}>
                    {d.status === 'under_review' ? 'under review' : d.status}
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(d.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-3 text-sm">
                <div>
                  <span className="text-gray-500">Raised by:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {d.raiser?.name || d.raiser?.email || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">({d.raiser?.role})</span>
                </div>
                <div>
                  <span className="text-gray-500">Against:</span>{' '}
                  <span className="font-medium text-gray-900">
                    {d.against?.name || d.against?.email || 'Unknown'}
                  </span>
                  <span className="text-xs text-gray-500 ml-1">({d.against?.role})</span>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-4">
                <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Reason</div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{d.reason}</p>
              </div>

              {d.resolution_note && (
                <div className="bg-green-50 border border-green-100 rounded p-3 mb-4">
                  <div className="text-xs text-green-700 uppercase tracking-wide mb-1">Resolution note</div>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{d.resolution_note}</p>
                  {d.resolved_at && (
                    <div className="text-xs text-gray-500 mt-1">
                      Resolved {new Date(d.resolved_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                <div className="w-full sm:w-48">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={d._status ?? d.status}
                    onChange={(e) => updateField(d, '_status', e.target.value)}
                    disabled={savingId === d.id}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="open">Open</option>
                    <option value="under_review">Under Review</option>
                    <option value="resolved">Resolved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Resolution note</label>
                  <input
                    type="text"
                    value={d._resolution_note ?? d.resolution_note ?? ''}
                    onChange={(e) => updateField(d, '_resolution_note', e.target.value)}
                    disabled={savingId === d.id}
                    placeholder={(d._status ?? d.status) === 'resolved' || (d._status ?? d.status) === 'rejected' ? 'Required' : 'Optional'}
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => saveDispute(d)}
                  disabled={savingId === d.id}
                  className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingId === d.id ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => fetchDisputes(page - 1)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {page} of {totalPages} ({total} total)
            </span>
            <button
              onClick={() => fetchDisputes(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

export async function getServerSideProps(context) {
  const guard = await requireAdminPage(context)
  if (guard.redirect) return { redirect: guard.redirect }
  return { props: { profile: guard.profile } }
}
