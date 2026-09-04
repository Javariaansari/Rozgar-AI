import { createClient } from '@/lib/supabaseServer'
import { createServiceRoleClient } from '@/lib/supabaseServiceRole'

export async function requireAdminPage(context) {
  const supabase = createClient(context.req, context.res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { redirect: { destination: '/login?error=admin-only', permanent: false } }
  }

  return { supabase, user, profile }
}

export async function requireAdminApi(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    res.status(401).json({ message: 'Not authenticated' })
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    res.status(403).json({ message: 'Admin access required' })
    return null
  }

  let admin
  try {
    admin = createServiceRoleClient()
  } catch (err) {
    res.status(500).json({ message: 'Server misconfigured' })
    return null
  }

  return { supabase, admin, user, profile }
}

export async function logAdminAction(admin, adminId, action, targetType, targetId, details = {}) {
  await admin.from('admin_actions').insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: String(targetId ?? ''),
    details,
  })
}
