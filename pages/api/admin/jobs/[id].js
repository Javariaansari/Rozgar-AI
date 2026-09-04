import { requireAdminApi, logAdminAction } from '@/lib/requireAdmin'

const VALID_STATUSES = ['open', 'in_progress', 'completed', 'cancelled']

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin, user } = guard
  const { id } = req.query

  if (!id) return res.status(400).json({ message: 'Job id required' })

  try {
    if (req.method === 'PATCH') {
      const { status, is_flagged, flag_reason } = req.body || {}
      const updates = {}

      if (status !== undefined) {
        if (!VALID_STATUSES.includes(status)) {
          return res.status(400).json({ message: 'Invalid status' })
        }
        updates.status = status
      }

      if (is_flagged !== undefined) {
        updates.is_flagged = !!is_flagged
        updates.flagged_at = is_flagged ? new Date().toISOString() : null
        updates.flagged_by = is_flagged ? user.id : null
        if (!is_flagged) updates.flag_reason = null
      }

      if (flag_reason !== undefined && updates.is_flagged !== false) {
        updates.flag_reason = flag_reason || null
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: 'No fields to update' })
      }

      const { data: job, error } = await admin
        .from('jobs')
        .update(updates)
        .eq('id', id)
        .select('*')
        .single()

      if (error) return res.status(500).json({ message: error.message })

      let action = 'job.update'
      if (status !== undefined) action = 'job.status_change'
      else if (is_flagged === true) action = 'job.flag'
      else if (is_flagged === false) action = 'job.unflag'

      await logAdminAction(admin, user.id, action, 'job', id, updates)

      return res.status(200).json({ job })
    }

    if (req.method === 'DELETE') {
      await logAdminAction(admin, user.id, 'job.delete', 'job', id, {})

      const { error } = await admin.from('jobs').delete().eq('id', id)
      if (error) return res.status(500).json({ message: error.message })

      return res.status(200).json({ message: 'Job deleted' })
    }

    return res.status(405).json({ message: 'Method not allowed' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
