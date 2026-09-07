import { useEffect, useState } from 'react'
import { requireAdminPage } from '@/lib/requireAdmin'
import AdminLayout from '@/components/AdminLayout'

const STATUS_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
]

export default function AdminTestimonials({ profile }) {
  const [testimonials, setTestimonials] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [savingId, setSavingId] = useState('')

  async function fetchTestimonials(pageNum = page) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      params.set('status', status)
      params.set('page', String(pageNum))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/testimonials?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load testimonials')
      setTestimonials(data.testimonials)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTestimonials(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function updateApproval(id, isApproved) {
    setSavingId(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_approved: isApproved }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Update failed')
      await fetchTestimonials(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId('')
    }
  }

  async function removeTestimonial(id) {
    if (!window.confirm('Are you sure you want to delete this feedback?')) return

    setSavingId(id)
    setError('')
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      await fetchTestimonials(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingId('')
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <AdminLayout profile={profile} title="Customer & Worker Feedback" subtitle="Approve or delete testimonials">
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      <div className="flex flex-wrap gap-2 mb-6">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatus(tab.key)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition ${
              status === tab.key
                ? 'bg-navy-50 text-primary'
                : 'bg-white text-muted hover:bg-navy-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading && testimonials.length === 0 ? (
        <p className="text-muted">Loading...</p>
      ) : testimonials.length === 0 ? (
        <p className="text-muted">No {status} feedback found.</p>
      ) : (
        <div className="space-y-4">
          {testimonials.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <div className="font-semibold text-heading">{t.name}</div>
                  <div className="text-xs text-muted capitalize">{t.role}</div>
                </div>
                <div className="text-right sm:text-left">
                  <div className="text-yellow-400 text-sm">
                    {'★'.repeat(t.stars || 0)}
                    <span className="text-navy-200">{'★'.repeat(5 - (t.stars || 0))}</span>
                  </div>
                  <div className="text-xs text-subtle mt-1">
                    {new Date(t.created_at).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="bg-page-bg border border-line rounded p-3 mb-4">
                <p className="text-sm text-heading whitespace-pre-wrap">{t.content}</p>
              </div>

              <div className="text-xs text-muted mb-4">
                By: {t.user?.name || t.user?.email || 'Unknown'} ({t.user?.role || 'unknown'})
              </div>

              <div className="flex flex-wrap gap-2">
                {status === 'pending' && (
                  <button
                    onClick={() => updateApproval(t.id, true)}
                    disabled={savingId === t.id}
                    className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {savingId === t.id ? 'Saving...' : 'Approve'}
                  </button>
                )}
                {status === 'approved' && (
                  <button
                    onClick={() => updateApproval(t.id, false)}
                    disabled={savingId === t.id}
                    className="px-4 py-2 bg-yellow-600 text-white rounded text-sm font-medium hover:bg-yellow-700 disabled:opacity-50"
                  >
                    {savingId === t.id ? 'Saving...' : 'Unapprove'}
                  </button>
                )}
                <button
                  onClick={() => removeTestimonial(t.id)}
                  disabled={savingId === t.id}
                  className="px-4 py-2 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => fetchTestimonials(page - 1)}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 bg-navy-100 text-body rounded text-sm font-medium hover:bg-navy-200 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-muted">
              Page {page} of {totalPages} ({total} total)
            </span>
            <button
              onClick={() => fetchTestimonials(page + 1)}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 bg-navy-100 text-body rounded text-sm font-medium hover:bg-navy-200 disabled:opacity-50"
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
