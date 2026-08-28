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
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return res.redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  res.redirect('/onboarding')
}
