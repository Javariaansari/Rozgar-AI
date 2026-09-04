import { createClient } from '@/lib/supabaseServer'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { code } = req.query
  if (!code) {
    return res.redirect('/login?error=no-code')
  }

  const supabase = createClient(req, res)
  const { error, data: { user } } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return res.redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') {
    return res.redirect('/admin')
  }

  if (!profile?.role) {
    return res.redirect('/login?error=profile-incomplete')
  }

  if (profile?.role === 'customer') {
    return res.redirect('/customer/dashboard')
  }

  res.redirect('/worker/dashboard')
}
