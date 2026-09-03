import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'worker') {
    return res.status(403).json({ message: 'Worker profile required' })
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('worker_profiles')
      .update({
        skills: [],
        bio: null,
        experience_years: null,
        location: null,
        voice_transcript: null,
        ai_skill_score: null,
      })
      .eq('user_id', user.id)

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({ message: 'Resume cleared' })
  }

  res.status(405).json({ message: 'Method not allowed' })
}
