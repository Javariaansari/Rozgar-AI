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
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'customer') {
    return res.status(403).json({ message: 'Customer profile required' })
  }

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      *,
      applications(
        id,
        status,
        applied_at,
        worker:profiles!worker_id(id, name, phone)
      )
    `)
    .eq('customer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return res.status(500).json({ message: error.message })
  }

  const workerIds = [...new Set(
    (jobs || [])
      .flatMap(j => j.applications || [])
      .map(a => a.worker?.id)
      .filter(Boolean)
  )]

  let workerProfileMap = {}
  if (workerIds.length > 0) {
    const { data: workerProfiles, error: wpError } = await supabase
      .from('worker_profiles')
      .select('user_id, skills, experience_years, ai_skill_score')
      .in('user_id', workerIds)

    if (wpError) {
      return res.status(500).json({ message: wpError.message })
    }

    workerProfileMap = Object.fromEntries(
      (workerProfiles || []).map(wp => [wp.user_id, wp])
    )
  }

  const jobsWithProfiles = (jobs || []).map(job => ({
    ...job,
    applications: (job.applications || []).map(app => ({
      ...app,
      worker_profile: workerProfileMap[app.worker?.id] || null
    }))
  }))

  res.status(200).json({ jobs: jobsWithProfiles })
}
