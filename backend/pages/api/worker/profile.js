import { createClient } from '@/lib/supabaseServer'

const phoneRegex = /^(\+92|0|92)\d{10}$/

function isValidPhone(phone) {
  return typeof phone === 'string' && phoneRegex.test(phone.trim())
}

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

  if (req.method === 'PUT') {
    const { name, phone, bio, skills, experience_years, location } = req.body

    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'A valid phone number is required (e.g. +923001234567)' })
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ name: name?.trim() || null, phone: phone.trim() })
      .eq('id', user.id)

    if (profileError) {
      return res.status(500).json({ message: profileError.message })
    }

    const { error: workerError } = await supabase
      .from('worker_profiles')
      .update({
        bio: bio?.trim() || null,
        skills: Array.isArray(skills) ? skills : [],
        experience_years: experience_years ? Number(experience_years) : null,
        location: location?.trim() || null,
      })
      .eq('user_id', user.id)

    if (workerError) {
      return res.status(500).json({ message: workerError.message })
    }

    return res.status(200).json({ message: 'Profile updated' })
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
