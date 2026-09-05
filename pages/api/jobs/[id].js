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

  if (!profile || profile.role !== 'customer') {
    return res.status(403).json({ message: 'Customer profile required' })
  }

  const { id } = req.query

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (jobError || !job) {
    return res.status(404).json({ message: 'Job not found' })
  }

  if (job.customer_id !== user.id) {
    return res.status(403).json({ message: 'You can only edit your own jobs' })
  }

  if (req.method === 'PUT') {
    const { title, description, category, budget, location, latitude, longitude } = req.body

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ message: 'Title is required' })
    }

    if (!location || typeof location !== 'string' || location.trim().length < 2) {
      return res.status(400).json({ message: 'Location is required' })
    }

    const coords = parseCoords(latitude, longitude)

    const { data: updatedJob, error } = await supabase
      .from('jobs')
      .update({
        title: title.trim(),
        description: description?.trim() || '',
        category: category?.trim() || '',
        budget: budget ? Number(budget) : null,
        location: location?.trim() || '',
        latitude: coords.lat,
        longitude: coords.lng,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({ job: updatedJob })
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('jobs').delete().eq('id', id)

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({ message: 'Job deleted' })
  }

  res.status(405).json({ message: 'Method not allowed' })
}

function parseCoords(latitude, longitude) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  const valid =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  return valid ? { lat, lng } : { lat: null, lng: null }
}
