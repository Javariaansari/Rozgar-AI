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
    <div className="min-h-screen bg-page-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-lg shadow p-6 max-w-md w-full text-center">
        <h1 className="text-lg font-semibold mb-2">Apna Feedback Dein</h1>
        <p className="text-sm text-muted mb-4">
          Verified customers and workers can share feedback directly from their dashboard.
        </p>
        <Link
          href="/login"
          className="inline-block px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary-dark"
        >
          Login
        </Link>
      </div>
    </div>
  )
}
