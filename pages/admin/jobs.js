import { useEffect, useState } from 'react'
import { requireAdminPage } from '@/lib/requireAdmin'
import AdminLayout from '@/components/AdminLayout'

const STATUS_BADGES = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
}

export default function AdminJobs({ profile }) {
  const [jobs, setJobs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [flagged, setFlagged] = useState(false)
  const [actionBusy, setActionBusy] = useState('')

  async function fetchJobs(pageNum = page) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (status) params.set('status', status)
      if (flagged) params.set('flagged', 'true')
      params.set('page', String(pageNum))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/jobs?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load jobs')
      setJobs(data.jobs)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, flagged])

  async function updateStatus(job, newStatus) {
    if (newStatus === job.status) return
    setActionBusy(`status-${job.id}`)
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Update failed')
      await fetchJobs(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionBusy('')
    }
  }

  async function toggleFlag(job) {
    const next = !job.is_flagged
    let reason = ''
    if (next) {
      reason = window.prompt('Flag reason (optional):') || ''
    }
    setActionBusy(`flag-${job.id}`)
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_flagged: next, flag_reason: reason }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Action failed')
      await fetchJobs(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionBusy('')
    }
  }

  async function deleteJob(job) {
    if (!window.confirm(`Delete job "${job.title}"? This cannot be undone.`)) return
    setActionBusy(`del-${job.id}`)
    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      await fetchJobs(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionBusy('')
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <AdminLayout profile={profile} title="Job Moderation" subtitle="Manage and moderate all jobs">
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search title, description, location"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={flagged}
              onChange={(e) => setFlagged(e.target.checked)}
              className="rounded border-gray-300"
            />
            Flagged only
          </label>
          <div className="text-sm text-gray-600 flex items-center">
            {total} job{total !== 1 && 's'} found
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Job</th>
                <th className="px-4 py-3 text-left font-medium">Customer</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Applicants</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No jobs found.</td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.id} className={`hover:bg-gray-50 ${job.is_flagged ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{job.title}</div>
                      <div className="text-xs text-gray-500">{job.category || 'No category'}</div>
                      {job.is_flagged && job.flag_reason && (
                        <div className="text-xs text-red-600 mt-1">Flagged: {job.flag_reason}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-900">{job.customer?.name || '(No name)'}</div>
                      <div className="text-xs text-gray-500">{job.customer?.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={job.status}
                        onChange={(e) => updateStatus(job, e.target.value)}
                        disabled={actionBusy === `status-${job.id}`}
                        className={`text-xs px-2 py-1 rounded font-medium border-0 ${STATUS_BADGES[job.status]}`}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{job.application_count}</td>
                    <td className="px-4 py-3 text-gray-600">{new Date(job.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleFlag(job)}
                          disabled={actionBusy === `flag-${job.id}`}
                          className={`px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${
                            job.is_flagged
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
                          }`}
                        >
                          {job.is_flagged ? 'Unflag' : 'Flag'}
                        </button>
                        <button
                          onClick={() => deleteJob(job)}
                          disabled={actionBusy === `del-${job.id}`}
                          className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => fetchJobs(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages} ({total} total)
          </span>
          <button
            onClick={() => fetchJobs(page + 1)}
            disabled={page >= totalPages || loading}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </AdminLayout>
  )
}

export async function getServerSideProps(context) {
  const guard = await requireAdminPage(context)
  if (guard.redirect) return { redirect: guard.redirect }
  return { props: { profile: guard.profile } }
}
