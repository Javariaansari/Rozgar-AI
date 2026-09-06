import Link from 'next/link'

export async function getServerSideProps(context) {
  const { createClient } = await import('@/lib/supabaseServer')
  const supabase = createClient(context.req, context.res)
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const destination =
      profile?.role === 'admin'
        ? '/admin'
        : profile?.role === 'worker'
        ? '/worker/dashboard'
        : '/customer/dashboard'

    return { redirect: { destination, permanent: false } }
  }

  return { props: {} }
}

export default function Feedback() {
  return (
    <div className="min-h-screen bg-page-bg mesh-gradient flex items-center justify-center px-4">
      <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 p-8 max-w-md w-full text-center animate-fade-in-up">
        <h1 className="text-2xl font-bold text-gradient mb-2">Apna Feedback Dein</h1>
        <p className="text-sm text-muted mb-6">
          Verified customers and workers can share feedback directly from their dashboard.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-2 btn-gradient rounded text-sm font-medium text-white"
        >
          Login
        </Link>
      </div>
    </div>
  )
}
