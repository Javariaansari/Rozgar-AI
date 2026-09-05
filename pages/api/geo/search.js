import { createClient } from '@/lib/supabaseServer'
import { searchPlaces } from '@/lib/geocode'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { q } = req.query
  try {
    const results = await searchPlaces(q)
    return res.status(200).json({ results })
  } catch (err) {
    console.error('Geocode search error:', err)
    return res.status(503).json({ message: 'Geocoding service unavailable', results: [] })
  }
}
