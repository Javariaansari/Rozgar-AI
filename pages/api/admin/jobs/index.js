import { requireAdminApi } from '@/lib/requireAdmin'

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin } = guard

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { q, status, flagged, page = '1', pageSize = '20' } = req.query

  let pageNum = parseInt(page, 10)
  let pageSizeNum = parseInt(pageSize, 10)
  if (Number.isNaN(pageNum) || pageNum < 1) pageNum = 1
  if (Number.isNaN(pageSizeNum) || pageSizeNum < 1) pageSizeNum = 20
  if (pageSizeNum > 100) pageSizeNum = 100

  const from = (pageNum - 1) * pageSizeNum
  const to = from + pageSizeNum - 1

  let query = admin
    .from('jobs')
    .select(
      '*, customer:profiles!jobs_customer_id_fkey(id, name, email), applications(id, status)',
      { count: 'exact' }
    )

  if (status && ['open', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    query = query.eq('status', status)
  }

  if (flagged === 'true') {
    query = query.eq('is_flagged', true)
  } else if (flagged === 'false') {
    query = query.eq('is_flagged', false)
  }

  if (q && q.trim()) {
    const safe = q.trim().replace(/[,()%]/g, ' ')
    if (safe) {
      query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,location.ilike.%${safe}%`)
    }
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return res.status(500).json({ message: error.message })
  }

  const jobs = (data || []).map((j) => ({
    ...j,
    application_count: j.applications ? j.applications.length : 0,
  }))

  res.status(200).json({
    jobs,
    total: count || 0,
    page: pageNum,
    pageSize: pageSizeNum,
  })
}
