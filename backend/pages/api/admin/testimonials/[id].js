import { requireAdminApi, logAdminAction } from '@/lib/requireAdmin'

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin, user } = guard
  const { id } = req.query

  if (!id) {
    return res.status(400).json({ message: 'Testimonial id required' })
  }

  if (req.method === 'PATCH') {
    const { is_approved } = req.body || {}

    if (typeof is_approved !== 'boolean') {
      return res.status(400).json({ message: 'is_approved boolean required' })
    }

    const { data: testimonial, error } = await admin
      .from('testimonials')
      .update({ is_approved })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    await logAdminAction(admin, user.id, 'testimonial.update', 'testimonial', id, { is_approved })

    return res.status(200).json({ testimonial })
  }

  if (req.method === 'DELETE') {
    const { error } = await admin.from('testimonials').delete().eq('id', id)

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    await logAdminAction(admin, user.id, 'testimonial.delete', 'testimonial', id, {})

    return res.status(200).json({ message: 'Testimonial deleted' })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
