import { requireAdminApi, logAdminAction } from '@/lib/requireAdmin'

const VALID_STATUSES = ['open', 'under_review', 'resolved', 'rejected']

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin, user } = guard
  const { id } = req.query

  if (req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!id) return res.status(400).json({ message: 'Dispute id required' })

  try {
    const { status, resolution_note } = req.body || {}

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' })
    }

    if ((status === 'resolved' || status === 'rejected') && (!resolution_note || !resolution_note.trim())) {
      return res.status(400).json({ message: 'Resolution note is required when resolving or rejecting' })
    }

    const now = new Date().toISOString()
    const updates = {
      status,
      resolution_note: resolution_note || null,
      resolved_by: status === 'resolved' || status === 'rejected' ? user.id : null,
      resolved_at: status === 'resolved' || status === 'rejected' ? now : null,
      updated_at: now,
    }

    const { data: dispute, error } = await admin
      .from('disputes')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single()

    if (error) return res.status(500).json({ message: error.message })

    await logAdminAction(admin, user.id, 'dispute.update', 'dispute', id, { status, resolution_note })

    res.status(200).json({ dispute })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
