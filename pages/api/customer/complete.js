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

  const { job_id, stars, review_text } = req.body
  if (!job_id) {
    return res.status(400).json({ message: 'Job ID required' })
  }
  if (!stars || stars < 1 || stars > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' })
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, customer_id, status')
    .eq('id', job_id)
    .single()

  if (jobError || !job) {
    return res.status(404).json({ message: 'Job not found' })
  }

  if (job.customer_id !== user.id) {
    return res.status(403).json({ message: 'Only the job owner can complete this job' })
  }

  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('worker_id')
    .eq('job_id', job_id)
    .eq('status', 'selected')
    .single()

  if (appError || !application) {
    return res.status(400).json({ message: 'No selected worker found for this job' })
  }

  const { error: updateError } = await supabase
    .from('jobs')
    .update({ status: 'completed' })
    .eq('id', job_id)

  if (updateError) {
    return res.status(500).json({ message: updateError.message })
  }

  const { error: ratingError } = await supabase
    .from('ratings')
    .insert({
      job_id,
      from_user_id: user.id,
      to_user_id: application.worker_id,
      stars,
      review_text: review_text?.trim() || '',
    })

  if (ratingError) {
    return res.status(500).json({ message: ratingError.message })
  }

  res.status(200).json({ message: 'Job completed and rating submitted' })
}
