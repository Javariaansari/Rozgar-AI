import { createClient } from '@/lib/supabaseServer'
import { createServiceRoleClient } from '@/lib/supabaseServiceRole'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  try {
    const admin = createServiceRoleClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    await supabase.auth.signOut()

    return res.status(200).json({ message: 'Account deleted' })
  } catch (err) {
    console.error('Account delete error:', err)
    return res.status(500).json({ message: err.message || 'Failed to delete account' })
  }
}
