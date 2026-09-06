import Link from 'next/link'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabaseClient'

const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/disputes', label: 'Disputes' },
  { href: '/admin/testimonials', label: 'Feedback' },
]

export default function AdminLayout({ profile, title, subtitle, actions, children }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <nav className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/admin" className="text-xl font-bold text-primary">
            Rozgar AI Admin
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted hidden sm:inline">{profile?.email}</span>
            <button
              onClick={handleSignOut}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Sign Out
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4 pb-2 flex gap-2 flex-wrap">
          {TABS.map((tab) => {
            const active = router.pathname === tab.href
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-1.5 rounded text-sm transition ${
                  active
                    ? 'bg-navy-50 text-primary font-medium'
                    : 'text-muted hover:bg-navy-100'
                }`}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-heading">{title}</h1>
            {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  )
}
