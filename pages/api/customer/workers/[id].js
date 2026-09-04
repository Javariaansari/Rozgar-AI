import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
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

  const { id } = req.query
  if (!id) {
    return res.status(400).json({ message: 'Worker id required' })
  }

  const { data: workerProfile, error: workerError } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('user_id', id)
    .single()

  if (workerError || !workerProfile) {
    return res.status(404).json({ message: 'Worker resume not found' })
  }

  const { data: worker } = await supabase
    .from('profiles')
    .select('id, name, phone, email, created_at')
    .eq('id', id)
    .single()

  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, status, applied_at, job:jobs(id, title, customer_id)')
    .eq('worker_id', id)
    .eq('job.customer_id', user.id)
    .order('applied_at', { ascending: false })
    .limit(1)
    .single()

  if (appError || !application) {
    return res.status(403).json({ message: 'You can only view resumes of workers who applied to your jobs' })
  }

  res.status(200).json({
    worker: worker || { id },
    workerProfile,
    application,
  })
}
