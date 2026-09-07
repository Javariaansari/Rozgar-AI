import { requireAdminApi, logAdminAction } from '@/lib/requireAdmin'

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin, user } = guard
  const { id } = req.query

  if (req.method !== 'DELETE') {
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
    if (target.id === user.id) return res.status(400).json({ message: 'Cannot delete yourself' })
    if (target.role === 'admin') return res.status(400).json({ message: 'Cannot delete an admin' })

    await logAdminAction(admin, user.id, 'user.delete', 'user', id, {})

    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) {
      return res.status(500).json({ message: error.message })
    }

    res.status(200).json({ message: 'User deleted' })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
