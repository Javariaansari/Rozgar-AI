import { createClient } from '@/lib/supabaseServer'

function fallbackTitle(text) {
  const lower = text.toLowerCase()
  if (lower.includes('electrician') || lower.includes('الیکٹریشن')) return 'Electrician needed'
  if (lower.includes('plumber') || lower.includes('پلمبر')) return 'Plumber needed'
  if (lower.includes('carpenter') || lower.includes('کارپینٹر')) return 'Carpenter needed'
  if (lower.includes('painter') || lower.includes('پینٹر')) return 'Painter needed'
  if (lower.includes('driver') || lower.includes('ڈرائیور')) return 'Driver needed'
  return 'Labor required'
}

function fallbackCategory(text) {
  const lower = text.toLowerCase()
  if (lower.includes('electrician') || lower.includes('الیکٹریشن')) return 'electrician'
  if (lower.includes('plumber') || lower.includes('پلمبر')) return 'plumber'
  if (lower.includes('carpenter') || lower.includes('کارپینٹر')) return 'carpenter'
  if (lower.includes('painter') || lower.includes('پینٹر')) return 'painter'
  if (lower.includes('driver') || lower.includes('ڈرائیور')) return 'driver'
  return 'general labor'
}

function fallbackBudget(text) {
  const m = text.match(/(?:budget|max|tak|تک)\s*(?:is\s*)?(?:rs\.?|pkr|rupees)?\s*(\d+)/i)
    || text.match(/(\d+)\s*(?:rs\.?|pkr|rupees)/i)
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'customer') {
    return res.status(403).json({ message: 'Customer profile required' })
  }

  try {
    const { extractJobFromVoice } = await import('@/lib/gemini')
    const extracted = await extractJobFromVoice(cleanText)

    if (!extracted.title) extracted.title = fallbackTitle(cleanText)
    if (!extracted.category) extracted.category = fallbackCategory(cleanText)
    if (extracted.budget == null) extracted.budget = fallbackBudget(cleanText)
    if (!extracted.location) extracted.location = fallbackLocation(cleanText)
    if (!extracted.description) extracted.description = cleanText

    res.status(200).json({
      extracted,
      message: 'Job details extracted from voice input',
    })
  } catch (err) {
    console.error('Voice-to-job error:', err)
    res.status(500).json({ message: 'Failed to process voice input', error: err.message })
  }
}
