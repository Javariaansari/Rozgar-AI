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

  if (!profile || profile.role !== 'worker') {
    return res.status(403).json({ message: 'Worker profile required' })
  }

  const { data, error } = await supabase
    .from('applications')
    .select(
      '*, job:jobs!applications_job_id_fkey(*, customer:profiles!jobs_customer_id_fkey(id, name))'
    )
    .eq('worker_id', user.id)
    .order('applied_at', { ascending: false })

  if (error) {
    return res.status(500).json({ message: error.message })
  }

  res.status(200).json({ applications: data || [] })
}
