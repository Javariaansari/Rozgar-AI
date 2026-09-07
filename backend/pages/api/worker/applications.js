import { createClient } from '@/lib/supabaseServer'
import { createServiceRoleClient } from '@/lib/supabaseServiceRole'

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

  if (!profile || profile.role !== 'worker') {
    return res.status(403).json({ message: 'Worker profile required' })
  }

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('applications')
      .select(
        '*, job:jobs!applications_job_id_fkey(*, customer:profiles!jobs_customer_id_fkey(id, name, phone))'
      )
      .eq('worker_id', user.id)
      .order('applied_at', { ascending: false })

    if (error) {
      return res.status(500).json({ message: error.message })
    }

    return res.status(200).json({ applications: data || [] })
  }

  if (req.method === 'DELETE') {
    const { application_id } = req.body
    if (!application_id) {
      return res.status(400).json({ message: 'Application ID required' })
    }

    const admin = createServiceRoleClient()

    const { data: application, error: fetchError } = await admin
      .from('applications')
      .select('id, status')
      .eq('id', application_id)
      .eq('worker_id', user.id)
      .single()

    if (fetchError || !application) {
      return res.status(404).json({ message: 'Application not found' })
    }

    if (application.status === 'selected') {
      return res.status(400).json({ message: 'Cannot withdraw a selected application' })
    }

    const { error: deleteError } = await admin
      .from('applications')
      .delete()
      .eq('id', application_id)

    if (deleteError) {
      return res.status(500).json({ message: deleteError.message })
    }

    return res.status(200).json({ message: 'Application withdrawn' })
  }

  res.status(405).json({ message: 'Method not allowed' })
}
