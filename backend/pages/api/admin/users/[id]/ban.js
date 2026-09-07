import { requireAdminApi, logAdminAction } from '@/lib/requireAdmin'

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin, user } = guard
  const { id } = req.query

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  if (!id) return res.status(400).json({ message: 'User id required' })

  try {
    const { data: target } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', id)
      .single()

    if (!target) return res.status(404).json({ message: 'User not found' })
    if (target.id === user.id) return res.status(400).json({ message: 'Cannot ban yourself' })
    if (target.role === 'admin') return res.status(400).json({ message: 'Cannot ban an admin' })

    const { banned, reason } = req.body || {}
    const now = new Date().toISOString()

    const { error: authError } = await admin.auth.admin.updateUserById(id, {
      ban_duration: banned ? '87600h' : 'none',
    })

    if (authError) {
      return res.status(500).json({ message: authError.message })
    }

    const { data: updated, error: profileError } = await admin
      .from('profiles')
      .update({
        is_banned: !!banned,
        banned_at: banned ? now : null,
        ban_reason: banned ? (reason || 'Banned by admin') : null,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (profileError) {
      return res.status(500).json({ message: profileError.message })
    }

    await logAdminAction(admin, user.id, banned ? 'user.ban' : 'user.unban', 'user', id, {
      reason: reason || null,
    })

    res.status(200).json({ message: banned ? 'User banned' : 'User unbanned', user: updated })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
