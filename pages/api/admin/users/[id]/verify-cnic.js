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
    if (target.role !== 'worker') return res.status(400).json({ message: 'Only workers can be CNIC verified' })

    const { cnic_verified } = req.body || {}
    const now = new Date().toISOString()

    const { data: workerProfile, error } = await admin
      .from('worker_profiles')
      .update({
        cnic_verified: !!cnic_verified,
        cnic_verified_at: cnic_verified ? now : null,
        cnic_verified_by: cnic_verified ? user.id : null,
      })
      .eq('user_id', id)
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    await logAdminAction(admin, user.id, cnic_verified ? 'worker.verify_cnic' : 'worker.unverify_cnic', 'user', id, {})

    res.status(200).json({ message: cnic_verified ? 'CNIC verified' : 'CNIC verification removed', worker_profile: workerProfile })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
