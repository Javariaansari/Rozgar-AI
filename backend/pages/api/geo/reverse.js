import { createClient } from '@/lib/supabaseServer'
import { reverseGeocode } from '@/lib/geocode'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { lat, lng } = req.query
  try {
    const result = await reverseGeocode(lat, lng)
    return res.status(200).json({ result })
  } catch (err) {
    console.error('Reverse geocode error:', err)
    return res.status(503).json({ message: 'Geocoding service unavailable', result: null })
  }
}
