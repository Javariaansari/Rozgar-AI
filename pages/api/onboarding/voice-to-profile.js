import { createClient } from '@/lib/supabaseServer'

function fallbackName(text) {
  const patterns = [
    /mera naam ([a-zA-Z ]+) hai/i,
    /my name is ([a-zA-Z ]+)/i,
    /i am ([a-zA-Z ]+)/i,
    /main ([a-zA-Z ]+) hoon/i,
    /nam ([a-zA-Z ]+) hai/i,
    /name is ([a-zA-Z ]+)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m && m[1].trim().length > 1) {
      return m[1].trim().replace(/\s+/g, ' ')
    }
  }
  return null
}

function fallbackExperience(text) {
  const m = text.match(/\b(\d+)\s*(?:saal|sal|سال|years?|yrs?)\b/i)
  return m ? Number(m[1]) : null
}

function fallbackLocation(text) {
  const lower = text.toLowerCase()
  const cities = [
    ['lahore', 'لاہور', 'Lahore'],
    ['karachi', 'کراچی', 'Karachi'],
    ['islamabad', 'اسلام آباد', 'Islamabad'],
    ['rawalpindi', 'راولپنڈی', 'Rawalpindi'],
    ['faisalabad', 'فیصل آباد', 'Faisalabad'],
    ['multan', 'ملتان', 'Multan'],
    ['peshawar', 'پشاور', 'Peshawar'],
    ['quetta', 'کوئٹہ', 'Quetta'],
    ['sialkot', 'سیالکوٹ', 'Sialkot'],
    ['gujranwala', 'گوجرانوالہ', 'Gujranwala'],
  ]
  for (const [en, ur, value] of cities) {
    if (lower.includes(en) || lower.includes(ur)) return value
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { text } = req.body
  const cleanText = text?.trim()
  if (!cleanText || typeof cleanText !== 'string' || cleanText.length < 10) {
    return res.status(400).json({ message: 'Text must be at least 10 characters' })
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  let { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    const role = user.user_metadata?.role === 'customer' ? 'customer' : 'worker'
    const { data: newProfile, error: createProfileError } = await supabase
      .from('profiles')
      .insert({ id: user.id, role })
      .select('role')
      .single()
    if (createProfileError) {
      if (createProfileError.code === '42501') {
        return res.status(403).json({
          message: 'Database setup incomplete. Please run the updated schema.sql in your Supabase SQL editor, then try again.',
        })
      }
      throw createProfileError
    }
    profile = newProfile

    if (role === 'worker') {
      await supabase.from('worker_profiles').insert({ user_id: user.id })
    } else {
      await supabase.from('customer_profiles').insert({ user_id: user.id })
    }
  }

  const isWorker = profile?.role === 'worker'

  try {
    const { extractProfileFromVoice } = await import('@/lib/gemini')
    const extracted = await extractProfileFromVoice(cleanText)

    if (!extracted.name) extracted.name = fallbackName(cleanText)
    if (extracted.experience_years == null) extracted.experience_years = fallbackExperience(cleanText)
    if (!extracted.location) extracted.location = fallbackLocation(cleanText)

    const updateData = {}
    if (extracted.name) updateData.name = extracted.name

    if (Object.keys(updateData).length > 0) {
      const { error: profileError } = await supabase.from('profiles').update(updateData).eq('id', user.id)
      if (profileError) throw profileError
    }

    if (isWorker) {
      const workerUpdate = { user_id: user.id, voice_transcript: cleanText }
      if (extracted.skills?.length > 0) workerUpdate.skills = extracted.skills
      if (extracted.bio) workerUpdate.bio = extracted.bio
      if (extracted.experience_years != null) workerUpdate.experience_years = extracted.experience_years
      if (extracted.location) workerUpdate.location = extracted.location

      const { error: workerError } = await supabase
        .from('worker_profiles')
        .upsert(workerUpdate, { onConflict: 'user_id' })
      if (workerError) throw workerError
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
