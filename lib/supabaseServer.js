import { createServerClient } from '@supabase/ssr'
import { serialize } from 'cookie'

export function createClient(req, res) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          const setCookies = cookiesToSet.map(({ name, value, options }) =>
            serialize(name, value, options)
          )
          res.setHeader('Set-Cookie', setCookies)
        },
      },
    }
  )
  return supabase
}
