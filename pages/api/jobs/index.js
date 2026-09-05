import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return res.status(403).json({ message: 'Profile required' })
  }

  if (req.method === 'GET') {
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select('*, customer:profiles!jobs_customer_id_fkey(name, phone)')
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({ jobs: jobs || [] })
  }

  if (req.method === 'POST') {
    if (profile.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can post jobs' })
    }

    if (!profile.phone) {
      return res.status(400).json({ message: 'Please add a phone number to your profile before posting a job' })
    }

    const { title, description, category, budget, location } = req.body

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({ message: 'Title is required' })
    }

    if (!location || typeof location !== 'string' || location.trim().length < 2) {
      return res.status(400).json({ message: 'Location is required' })
    }

    const { data: job, error } = await supabase
      .from('jobs')
      .insert({
        customer_id: user.id,
        title: title.trim(),
        description: description?.trim() || '',
        category: category?.trim() || '',
        budget: budget ? Number(budget) : null,
        location: location?.trim() || '',
      })
      .select()
      .single()

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(201).json({ job })
  }

  res.status(405).json({ message: 'Method not allowed' })
}
