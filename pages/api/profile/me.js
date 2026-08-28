import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return res.status(404).json({ message: 'Profile not found' })
  }

  let roleProfile = null
  if (profile.role === 'worker') {
    const { data } = await supabase
      .from('worker_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    roleProfile = data
  } else {
    const { data } = await supabase
      .from('customer_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
    roleProfile = data
  }

  res.status(200).json({
    user: { id: user.id, email: user.email },
    profile,
    roleProfile,
  })
}
