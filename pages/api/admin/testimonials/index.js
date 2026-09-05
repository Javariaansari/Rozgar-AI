import { requireAdminApi } from '@/lib/requireAdmin'

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin } = guard

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { status = 'pending', page = '1', pageSize = '20' } = req.query

  let pageNum = parseInt(page, 10)
  let pageSizeNum = parseInt(pageSize, 10)
  if (Number.isNaN(pageNum) || pageNum < 1) pageNum = 1
  if (Number.isNaN(pageSizeNum) || pageSizeNum < 1) pageSizeNum = 20
  if (pageSizeNum > 100) pageSizeNum = 100

  const from = (pageNum - 1) * pageSizeNum
  const to = from + pageSizeNum - 1

  let query = admin
    .from('testimonials')
    .select('*, user:profiles!testimonials_user_id_fkey(id, name, email, role)', { count: 'exact' })

  if (status === 'approved') {
    query = query.eq('is_approved', true)
  } else if (status === 'pending') {
    query = query.eq('is_approved', false)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    return res.status(500).json({ message: error.message })
  }

  res.status(200).json({
    testimonials: data || [],
    total: count || 0,
    page: pageNum,
    pageSize: pageSizeNum,
  })
}
