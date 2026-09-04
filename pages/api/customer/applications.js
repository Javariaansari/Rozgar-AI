import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { application_id, status } = req.body
  if (!application_id || !['selected', 'rejected'].includes(status)) {
    return res.status(400).json({ message: 'Application ID and valid status required' })
  }

  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, job_id, worker_id, jobs!inner(customer_id)')
    .eq('id', application_id)
    .single()

  if (appError || !application) {
    return res.status(404).json({ message: 'Application not found' })
  }

  if (application.jobs.customer_id !== user.id) {
    return res.status(403).json({ message: 'Only the job owner can update applications' })
  }

  if (status === 'selected') {
    const { data: phones, error: phoneError } = await supabase
      .from('profiles')
      .select('id, phone')
      .in('id', [application.worker_id, user.id])

    if (phoneError) {
      return res.status(500).json({ message: phoneError.message })
    }

    const phoneMap = Object.fromEntries((phones || []).map((p) => [p.id, p.phone]))
    if (!phoneMap[application.worker_id]) {
      return res.status(400).json({ message: 'Worker has not added a phone number yet' })
    }
    if (!phoneMap[user.id]) {
      return res.status(400).json({ message: 'Please add a phone number to your profile before selecting a worker' })
    }

    const { error: rejectOthersError } = await supabase
      .from('applications')
      .update({ status: 'rejected' })
      .eq('job_id', application.job_id)
      .neq('id', application_id)

    if (rejectOthersError) {
      return res.status(500).json({ message: rejectOthersError.message })
    }

    const { error: jobStatusError } = await supabase
      .from('jobs')
      .update({ status: 'in_progress' })
      .eq('id', application.job_id)

    if (jobStatusError) {
      return res.status(500).json({ message: jobStatusError.message })
    }

    const { error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', application_id)

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({
      message: 'Application selected',
      worker_phone: phoneMap[application.worker_id],
      customer_phone: phoneMap[user.id],
    })
  }

  const { error } = await supabase
    .from('applications')
    .update({ status })
    .eq('id', application_id)

  if (error) {
    return res.status(500).json({ message: error.message })
  }

  res.status(200).json({ message: 'Application rejected' })
}
