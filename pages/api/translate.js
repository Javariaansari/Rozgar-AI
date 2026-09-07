import { createClient } from '@/lib/supabaseServer'
import { translateToEnglish } from '@/lib/gemini'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { text } = req.body || {}

  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Text is required' })
  }

  try {
    const translated = await translateToEnglish(text.trim())
    return res.status(200).json({ translated })
  } catch (err) {
    return res.status(500).json({ message: err.message || 'Translation failed' })
  }
}
