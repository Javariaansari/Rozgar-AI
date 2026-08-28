import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { text } = req.body
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return res.status(400).json({ message: 'Text must be at least 10 characters' })
  }

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

  if (profile?.role !== 'worker') {
    return res.status(403).json({ message: 'Only workers can use voice onboarding' })
  }

  try {
    const { extractProfileFromVoice } = await import('@/lib/gemini')
    const extracted = await extractProfileFromVoice(text.trim())

    const updateData = {}
    if (extracted.name) updateData.name = extracted.name
    if (extracted.location) updateData.phone = extracted.location

    if (Object.keys(updateData).length > 0) {
      await supabase.from('profiles').update(updateData).eq('id', user.id)
    }

    const workerUpdate = {}
    if (extracted.skills?.length > 0) workerUpdate.skills = extracted.skills
    if (extracted.bio) workerUpdate.bio = extracted.bio

    if (Object.keys(workerUpdate).length > 0) {
      await supabase.from('worker_profiles').update(workerUpdate).eq('user_id', user.id)
    }

    res.status(200).json({
      extracted,
      message: 'Profile updated from voice input',
    })
  } catch (err) {
    console.error('Voice-to-profile error:', err)
    res.status(500).json({ message: 'Failed to process voice input', error: err.message })
  }
}
