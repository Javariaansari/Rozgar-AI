import { requireAdminApi } from '@/lib/requireAdmin'

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin } = guard

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { q, role, status, page = '1', pageSize = '20' } = req.query

  let pageNum = parseInt(page, 10)
  let pageSizeNum = parseInt(pageSize, 10)
  if (Number.isNaN(pageNum) || pageNum < 1) pageNum = 1
  if (Number.isNaN(pageSizeNum) || pageSizeNum < 1) pageSizeNum = 20
  if (pageSizeNum > 100) pageSizeNum = 100

  const from = (pageNum - 1) * pageSizeNum
  const to = from + pageSizeNum - 1

  let query = admin
    .from('profiles')
    .select(
      'id, name, phone, email, role, is_banned, banned_at, ban_reason, created_at',
      { count: 'exact' }
    )

  if (role && ['worker', 'customer', 'admin'].includes(role)) {
    query = query.eq('role', role)
  }

  if (status === 'active') {
    query = query.eq('is_banned', false)
  } else if (status === 'banned') {
    query = query.eq('is_banned', true)
  }

  if (q && q.trim()) {
    const safe = q.trim().replace(/[,()%]/g, ' ')
    if (safe) {
      query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`)
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return res.status(500).json({ message: error.message })
  }

  let users = data || []

  const workerIds = users.filter((u) => u.role === 'worker').map((u) => u.id)
  if (workerIds.length > 0) {
    const { data: workerProfiles, error: workerError } = await admin
      .from('worker_profiles')
      .select('user_id, skills, cnic_verified, cnic_url, cnic_verified_at, average_rating, total_reviews')
      .in('user_id', workerIds)

    if (workerError) {
      return res.status(500).json({ message: workerError.message })
    }

    const workerMap = Object.fromEntries((workerProfiles || []).map((w) => [w.user_id, w]))
    users = users.map((u) => ({
      ...u,
      worker_profile: workerMap[u.id] || null,
    }))
  }

  res.status(200).json({
    users,
    total: count || 0,
    page: pageNum,
    pageSize: pageSizeNum,
  })
}
