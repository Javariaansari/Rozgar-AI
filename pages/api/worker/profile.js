import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
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

  if (!profile || profile.role !== 'worker') {
    return res.status(403).json({ message: 'Worker profile required' })
  }

  if (req.method === 'GET') {
    const { data: workerProfile } = await supabase
      .from('worker_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    return res.status(200).json({ profile, workerProfile })
  }

  if (req.method === 'PUT') {
    const { name, phone, skills, bio } = req.body

    const profileUpdate = {}
    if (name !== undefined) profileUpdate.name = name
    if (phone !== undefined) profileUpdate.phone = phone

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id)
      if (error) return res.status(500).json({ message: error.message })
    }

    const workerUpdate = {}
    if (skills !== undefined) workerUpdate.skills = skills
    if (bio !== undefined) workerUpdate.bio = bio

    if (Object.keys(workerUpdate).length > 0) {
      const { error } = await supabase.from('worker_profiles').update(workerUpdate).eq('user_id', user.id)
      if (error) return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({ message: 'Profile updated' })
  }

  res.status(405).json({ message: 'Method not allowed' })
}
