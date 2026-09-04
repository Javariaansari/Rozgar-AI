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

  if (!profile || !['customer', 'worker'].includes(profile.role)) {
    return res.status(403).json({ message: 'Customer or worker profile required' })
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('disputes')
      .select(
        '*, job:jobs!disputes_job_id_fkey(id, title, status), against:profiles!disputes_against_user_id_fkey(id, name)'
      )
      .order('created_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({ disputes: data || [] })
  }

  if (req.method === 'POST') {
    const { job_id, reason } = req.body || {}

    if (!job_id) {
      return res.status(400).json({ message: 'Job ID is required' })
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      return res.status(400).json({ message: 'Reason must be at least 10 characters' })
    }

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, customer_id, status')
      .eq('id', job_id)
      .single()

    if (jobError || !job) {
      return res.status(404).json({ message: 'Job not found' })
    }

    let against_user_id = null

    if (profile.role === 'customer') {
      if (job.customer_id !== user.id) {
        return res.status(403).json({ message: 'You can only dispute jobs you posted' })
      }

      const { data: selectedApp } = await supabase
        .from('applications')
        .select('worker_id')
        .eq('job_id', job_id)
        .eq('status', 'selected')
        .single()

      against_user_id = selectedApp?.worker_id || null
    } else {
      const { data: application, error: appError } = await supabase
        .from('applications')
        .select('id')
        .eq('job_id', job_id)
        .eq('worker_id', user.id)
        .single()

      if (appError || !application) {
        return res.status(403).json({ message: 'You can only dispute jobs you applied to' })
      }

      against_user_id = job.customer_id
    }

    const { data: dispute, error: insertError } = await supabase
      .from('disputes')
      .insert({
        job_id,
        raised_by: user.id,
        against_user_id,
        reason: reason.trim(),
      })
      .select(
        '*, job:jobs!disputes_job_id_fkey(id, title, status), against:profiles!disputes_against_user_id_fkey(id, name)'
      )
      .single()

    if (insertError) {
      return res.status(500).json({ message: insertError.message })
    }

    return res.status(201).json({ dispute })
  }

  res.status(405).json({ message: 'Method not allowed' })
}
