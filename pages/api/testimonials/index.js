import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  const supabase = createClient(req, res)

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('testimonials')
      .select('*')
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({ testimonials: data || [] })
  }

  if (req.method === 'POST') {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return res.status(401).json({ message: 'Not authenticated' })
    }

    const { name, role, content, stars, voice_transcript } = req.body || {}

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Name is required' })
    }

    if (!['customer', 'worker'].includes(role)) {
      return res.status(400).json({ message: 'Role must be customer or worker' })
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Feedback text is required' })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const safeStars = stars ? parseInt(stars, 10) : null

    const { data: testimonial, error } = await supabase
      .from('testimonials')
      .insert({
        user_id: user.id,
        name: name.trim(),
        role,
        content: content.trim(),
        stars: safeStars && safeStars >= 1 && safeStars <= 5 ? safeStars : null,
        voice_transcript: voice_transcript ? voice_transcript.trim() : null,
        is_approved: false,
      })
      .select('*')
      .single()

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(201).json({ testimonial, message: 'Feedback submitted for review' })
  }

  return res.status(405).json({ message: 'Method not allowed' })
}
