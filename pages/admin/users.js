import { useEffect, useState } from 'react'
import { requireAdminPage } from '@/lib/requireAdmin'
import AdminLayout from '@/components/AdminLayout'

const ROLE_BADGES = {
  worker: 'bg-purple-100 text-purple-800',
  customer: 'bg-blue-100 text-blue-800',
  admin: 'bg-gray-100 text-gray-800',
}

function Badge({ children, color = 'bg-gray-100 text-gray-800' }) {
  return <span className={`text-xs px-2 py-0.5 rounded font-medium ${color}`}>{children}</span>
}

export default function AdminUsers({ profile }) {
  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [actionBusy, setActionBusy] = useState('')

  async function fetchUsers(pageNum = page) {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (q.trim()) params.set('q', q.trim())
      if (role) params.set('role', role)
      if (status) params.set('status', status)
      params.set('page', String(pageNum))
      params.set('pageSize', String(pageSize))

      const res = await fetch(`/api/admin/users?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Failed to load users')
      setUsers(data.users)
      setTotal(data.total)
      setPage(data.page)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, role, status])

  async function toggleBan(user) {
    const banned = !user.is_banned
    let reason = ''
    if (banned) {
      reason = window.prompt('Ban reason (required):') || ''
      if (!reason.trim()) return
    }
    if (!window.confirm(`${banned ? 'Ban' : 'Unban'} ${user.name || user.email}?`)) return

    setActionBusy(user.id)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banned, reason: reason.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Action failed')
      await fetchUsers(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionBusy('')
    }
  }

  async function toggleCnic(user) {
    const wp = user.worker_profile
    if (!wp) return
    const next = !wp.cnic_verified
    if (!window.confirm(`${next ? 'Verify' : 'Remove verification for'} CNIC for ${user.name || user.email}?`)) return

    setActionBusy(`cnic-${user.id}`)
    try {
      const res = await fetch(`/api/admin/users/${user.id}/verify-cnic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnic_verified: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Action failed')
      await fetchUsers(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionBusy('')
    }
  }

  async function deleteUser(user) {
    if (!window.confirm(`Permanently delete ${user.name || user.email}? This cannot be undone.`)) return
    setActionBusy(`del-${user.id}`)
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Delete failed')
      await fetchUsers(page)
    } catch (err) {
      setError(err.message)
    } finally {
      setActionBusy('')
    }
  }

  const totalPages = Math.ceil(total / pageSize) || 1

  return (
    <AdminLayout profile={profile} title="User Management" subtitle="Search, ban, verify, and delete users">
      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Search name, email, phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All roles</option>
            <option value="worker">Worker</option>
            <option value="customer">Customer</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="banned">Banned</option>
          </select>
          <div className="text-sm text-gray-600 flex items-center">
            {total} user{total !== 1 && 's'} found
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">CNIC</th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">Loading...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">No users found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{u.name || '(No name)'}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                      {u.phone && <div className="text-xs text-gray-500">{u.phone}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge color={ROLE_BADGES[u.role]}>{u.role}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {u.is_banned ? (
                        <Badge color="bg-red-100 text-red-800">Banned</Badge>
                      ) : (
                        <Badge color="bg-green-100 text-green-800">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {u.role === 'worker' && u.worker_profile ? (
                        <div className="space-y-1">
                          <Badge color={u.worker_profile.cnic_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                            {u.worker_profile.cnic_verified ? 'Verified' : 'Pending'}
                          </Badge>
                          {u.worker_profile.cnic_url && (
                            <a
                              href={u.worker_profile.cnic_url}
                              target="_blank"
                              rel="noreferrer"
                              className="block text-xs text-blue-600 hover:underline"
                            >
                              View document
                            </a>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {u.role === 'worker' && u.worker_profile && (
                          <button
                            onClick={() => toggleCnic(u)}
                            disabled={actionBusy === `cnic-${u.id}`}
                            className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
                          >
                            {u.worker_profile.cnic_verified ? 'Unverify CNIC' : 'Verify CNIC'}
                          </button>
                        )}
                        {u.role !== 'admin' && (
                          <>
                            <button
                              onClick={() => toggleBan(u)}
                              disabled={actionBusy === u.id}
                              className={`px-2 py-1 rounded text-xs font-medium disabled:opacity-50 ${
                                u.is_banned
                                  ? 'bg-green-50 text-green-700 hover:bg-green-100'
                                  : 'bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                              }`}
                            >
                              {u.is_banned ? 'Unban' : 'Ban'}
                            </button>
                            <button
                              onClick={() => deleteUser(u)}
                              disabled={actionBusy === `del-${u.id}`}
                              className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
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
            onClick={() => fetchUsers(page - 1)}
            disabled={page <= 1 || loading}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages} ({total} total)
          </span>
          <button
            onClick={() => fetchUsers(page + 1)}
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
