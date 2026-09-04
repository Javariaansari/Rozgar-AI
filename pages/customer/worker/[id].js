import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
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
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'customer') {
    return { redirect: { destination: '/login', permanent: false } }
  }

  return { props: {} }
}

function StarRating({ stars, count }) {
  if (!stars) return null
  return (
    <div className="flex items-center gap-2">
      <span className="text-yellow-500 text-sm">
        {'★'.repeat(Math.round(stars))}
        {'☆'.repeat(5 - Math.round(stars))}
      </span>
      <span className="text-sm text-gray-600">
        {stars} / 5 ({count || 0} review{count === 1 ? '' : 's'})
      </span>
    </div>
  )
}

export default function WorkerResumePage() {
  const router = useRouter()
  const { id } = router.query
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (!id) return

    async function load() {
      setLoading(true)
      setError('')
      const res = await fetch(`/api/customer/workers/${id}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.message || 'Failed to load resume')
      } else {
        setData(json)
      }
      setLoading(false)
    }

    load()
  }, [id])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const worker = data?.worker
  const workerProfile = data?.workerProfile
  const application = data?.application

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">Rozgar AI</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/customer/dashboard')}
              className="text-sm text-blue-600 hover:underline"
            >
              Back to Dashboard
            </button>
            <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        {loading ? (
          <p className="text-gray-500 text-sm">Loading resume...</p>
        ) : !data ? null : (
          <>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
              <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-8 text-white">
                <div className="flex items-start gap-5">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-white/20 overflow-hidden flex items-center justify-center border-2 border-white/40">
                      {workerProfile?.profile_pic_url ? (
                        <img src={workerProfile.profile_pic_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">👤</span>
                      )}
                    </div>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold">{worker?.name || 'Unnamed Worker'}</h2>
                    <p className="text-blue-100 mt-1">
                      {workerProfile?.skills?.slice(0, 3).join(' • ') || 'General Labor'}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-blue-50">
                      {worker?.phone && <span>📞 {worker.phone}</span>}
                      {worker?.email && <span>✉️ {worker.email}</span>}
                      {workerProfile?.location && <span>📍 {workerProfile.location}</span>}
                    </div>
                    {workerProfile?.average_rating != null && (
                      <div className="mt-3 text-white">
                        <StarRating stars={workerProfile.average_rating} count={workerProfile.total_reviews} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <section>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                    Professional Summary
                  </h3>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {workerProfile?.bio || 'No professional summary added yet.'}
                  </p>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                    Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {workerProfile?.skills?.length > 0 ? (
                      workerProfile.skills.map((skill, i) => (
                        <span
                          key={i}
                          className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm font-medium border border-blue-100"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-gray-400">No skills added yet</span>
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                    Experience
                  </h3>
                  <div className="text-sm text-gray-700">
                    {workerProfile?.experience_years ? (
                      <>
                        <p className="font-medium">{workerProfile.experience_years} years</p>
                        <p className="text-gray-600 mt-1">
                          Hands-on experience in {workerProfile.skills?.join(', ') || 'the listed skills'}.
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-500">Experience not specified.</p>
                    )}
                  </div>
                </section>

                {workerProfile?.voice_transcript && (
                  <section>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                      Voice Resume
                    </h3>
                    <div className="bg-gray-50 border border-gray-200 rounded p-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" dir="auto">
                        {workerProfile.voice_transcript}
                      </p>
                    </div>
                  </section>
                )}

                {workerProfile?.ai_skill_score && Object.keys(workerProfile.ai_skill_score).length > 0 && (
                  <section>
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                      AI Skill Score
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(workerProfile.ai_skill_score).map(([skill, score]) => (
                        <div key={skill} className="flex items-center gap-3 text-sm">
                          <span className="text-gray-700 w-28 font-medium">{skill}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${score}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 w-10 text-right">{score}%</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                    Trust & Verification
                  </h3>
                  <div className="flex flex-wrap items-center gap-3">
                    {workerProfile?.cnic_verified ? (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-green-100 text-green-800">
                        ✅ CNIC Verified
                      </span>
                    ) : workerProfile?.cnic_url ? (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-yellow-100 text-yellow-800">
                        ⏳ CNIC pending verification
                      </span>
                    ) : (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-800">
                        ⏳ CNIC Not Verified
                      </span>
                    )}
                    {workerProfile?.cnic_url && (
                      <a
                        href={workerProfile.cnic_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View uploaded CNIC
                      </a>
                    )}
                  </div>
                </section>
              </div>
            </div>

            {application && (
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Application</h3>
                <p className="text-sm text-gray-700">
                  Applied for <span className="font-medium">{application.job?.title || 'your job'}</span> on{' '}
                  {new Date(application.applied_at).toLocaleDateString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">Status: {application.status}</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
