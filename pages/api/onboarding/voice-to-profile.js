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

  const isWorker = profile?.role === 'worker'

  try {
    const { extractProfileFromVoice } = await import('@/lib/gemini')
    const extracted = await extractProfileFromVoice(text.trim())

    const updateData = {}
    if (extracted.name) updateData.name = extracted.name

    if (Object.keys(updateData).length > 0) {
      await supabase.from('profiles').update(updateData).eq('id', user.id)
    }

    if (isWorker) {
      const workerUpdate = {}
      if (extracted.skills?.length > 0) workerUpdate.skills = extracted.skills
      if (extracted.bio) workerUpdate.bio = extracted.bio
      if (extracted.experience_years != null) workerUpdate.experience_years = extracted.experience_years
      if (extracted.location) workerUpdate.location = extracted.location
      workerUpdate.voice_transcript = text.trim()

      await supabase.from('worker_profiles').update(workerUpdate).eq('user_id', user.id)
    }

    res.status(200).json({
      extracted,
      message: 'Profile updated from transcript input',
    })
  } catch (err) {
    console.error('Voice-to-profile error:', err)
    res.status(500).json({ message: 'Failed to process voice input', error: err.message })
  }
}
