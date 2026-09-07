import { createClient } from '@/lib/supabaseServer'
import { matchJobs } from '@/lib/gemini'

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

  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*, customer:profiles!jobs_customer_id_fkey(name, phone)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })

  if (jobsError) {
    return res.status(500).json({ message: jobsError.message })
  }

  if (!jobs || jobs.length === 0) {
    return res.status(200).json({ matches: [] })
  }

  try {
    const matches = await matchJobs(workerProfile, jobs)

    const enriched = matches
      .map(m => {
        const job = jobs.find(j => j.id === m.job_id)
        if (!job) return null
        return {
          ...job,
          match_score: m.match_score,
          reasoning: m.reasoning,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b.match_score - a.match_score)

    res.status(200).json({ matches: enriched })
  } catch (err) {
    console.error('Match jobs error:', err)
    res.status(500).json({ message: 'Failed to match jobs' })
  }
}
