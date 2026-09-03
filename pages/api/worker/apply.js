import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

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

  if (!profile || profile.role !== 'worker') {
    return res.status(403).json({ message: 'Worker profile required' })
  }

  const { job_id } = req.body
  if (!job_id) {
    return res.status(400).json({ message: 'Job ID required' })
  }

  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', job_id)
    .eq('worker_id', user.id)
    .single()

  if (existing) {
    return res.status(409).json({ message: 'Already applied to this job' })
  }

  const { error } = await supabase
    .from('applications')
    .insert({ job_id, worker_id: user.id })

  if (error) {
    return res.status(500).json({ message: error.message })
  }

  res.status(200).json({ message: 'Application submitted' })
}
