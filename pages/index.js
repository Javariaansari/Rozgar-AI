import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabaseClient'

export default function Home() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      router.replace(user ? '/onboarding' : '/login')
    })
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500">Loading...</p>
    </div>
  )
}
