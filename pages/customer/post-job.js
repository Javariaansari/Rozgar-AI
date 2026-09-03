import { useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabaseClient'

export async function getServerSideProps(context) {
  const { createClient: createServerClient } = await import('@/lib/supabaseServer')
  const supabase = createServerClient(context.req, context.res)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'customer') {
    return { redirect: { destination: '/login', permanent: false } }
  }

  return { props: { profile: profile || null } }
}

export default function PostJob({ profile }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    budget: '',
    location: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.message || 'Failed to post job')
      return
    }

    setSuccess('Job posted successfully')
    setForm({ title: '', description: '', category: '', budget: '', location: '' })
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">Rozgar AI</h1>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{success}</div>}

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-1">Post a Job</h2>
          <p className="text-sm text-gray-600 mb-6">Describe the work and AI will match it with the right workers.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Electrician for home wiring"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input
                value={form.category}
                onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. electrician, plumber, driver"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4}
                placeholder="Describe the work, requirements, and timing..."
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget (PKR)</label>
                <input
                  type="number"
                  value={form.budget}
                  onChange={(e) => setForm(f => ({ ...f, budget: e.target.value }))}
                  placeholder="e.g. 5000"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  value={form.location}
                  onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Lahore, Model Town"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {loading ? 'Posting...' : 'Post Job'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
