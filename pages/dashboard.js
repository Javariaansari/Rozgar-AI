export async function getServerSideProps(context) {
  const { createClient } = await import('@/lib/supabaseServer')
  const supabase = createClient(context.req, context.res)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const destination =
    profile?.role === 'admin'
      ? '/admin'
      : profile?.role === 'customer'
      ? '/customer/dashboard'
      : '/worker/dashboard'

  return { redirect: { destination, permanent: false } }
}

export default function Dashboard() {
  return null
}
