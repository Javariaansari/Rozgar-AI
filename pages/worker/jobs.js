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

  if (!profile || profile.role !== 'worker') {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return {
    props: {
      profile: profile || null,
      workerProfile: workerProfile || null,
    },
  }
}

export default function WorkerJobs({ profile, workerProfile }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function findMatches() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/jobs/matches', { method: 'POST' })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.message || 'Failed to find matches')
      return
    }

    setMatches(data.matches || [])
  }

  async function applyToJob(jobId) {
    const res = await fetch('/api/worker/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: jobId }),
    })

    const data = await res.json()
    if (!res.ok) {
      alert(data.message || 'Apply failed')
      return
    }

    alert('Application submitted')
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <nav className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">Rozgar AI</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/worker/dashboard')}
              className="text-sm text-primary hover:underline"
            >
              Dashboard
            </button>
            <button onClick={handleLogout} className="text-sm text-muted hover:text-primary">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">AI Job Matches</h2>
            <p className="text-sm text-muted">
              Your skills: {workerProfile?.skills?.join(', ') || 'general labor'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/worker/profile')}
              className="text-sm text-primary hover:underline"
            >
              Skill Passport
            </button>
            <button
              onClick={findMatches}
              disabled={loading}
              className="px-4 py-2 bg-primary text-white rounded text-sm font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? 'Matching...' : 'Find Matches'}
            </button>
          </div>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        {matches.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-muted text-sm">
            No matches yet. Click <strong>Find Matches</strong> to see AI-recommended jobs.
          </div>
        )}

        <div className="space-y-4">
          {matches.map((job) => (
            <div key={job.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="font-medium text-heading">{job.title}</h3>
                  <p className="text-sm text-muted">
                    {job.customer?.name || 'Customer'}
                    {job.customer?.phone && ` • 📞 ${job.customer.phone}`}
                    {' • '}
                    {job.location || 'No location'}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-primary">{job.match_score}%</div>
                  <div className="text-xs text-muted">match</div>
                </div>
              </div>

              <p className="text-sm text-body mb-3">{job.description || 'No description'}</p>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                {job.category && (
                  <span className="text-xs bg-navy-100 text-body px-2 py-0.5 rounded">{job.category}</span>
                )}
                {job.budget && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">PKR {job.budget}</span>
                )}
              </div>

              <div className="bg-navy-50 border border-navy-200 rounded p-3 mb-4">
                <p className="text-sm text-navy-900">{job.reasoning}</p>
              </div>

              <button
                onClick={() => applyToJob(job.id)}
                className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
              >
                Apply Now
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
