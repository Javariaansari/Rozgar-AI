import { useState, useRef, useEffect } from 'react'
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

  let { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!workerProfile) {
    const { data: newWorkerProfile, error: createError } = await supabase
      .from('worker_profiles')
      .insert({ user_id: user.id })
      .select('*')
      .single()
    if (createError) throw createError
    workerProfile = newWorkerProfile
  }

  const { data: reviews } = await supabase
    .from('ratings')
    .select('id, stars, review_text, created_at, job_id, from_user_id')
    .eq('to_user_id', user.id)
    .order('created_at', { ascending: false })

  let enrichedReviews = reviews || []
  if (enrichedReviews.length > 0) {
    const reviewerIds = [...new Set(enrichedReviews.map((r) => r.from_user_id))]
    const jobIds = [...new Set(enrichedReviews.map((r) => r.job_id))]

    const [{ data: reviewers }, { data: jobs }] = await Promise.all([
      supabase.from('profiles').select('id, name').in('id', reviewerIds),
      supabase.from('jobs').select('id, title').in('id', jobIds),
    ])

    const reviewerMap = Object.fromEntries((reviewers || []).map((p) => [p.id, p.name]))
    const jobMap = Object.fromEntries((jobs || []).map((j) => [j.id, j.title]))

    enrichedReviews = enrichedReviews.map((r) => ({
      ...r,
      reviewer_name: reviewerMap[r.from_user_id] || 'Customer',
      job_title: jobMap[r.job_id] || 'Job',
    }))
  }

  return {
    props: {
      profile: profile || null,
      workerProfile: workerProfile || null,
      reviews: enrichedReviews,
    },
  }
}

export default function WorkerDashboard({ profile, workerProfile, reviews = [] }) {
  const router = useRouter()
  const supabase = createClient()

  const [showVoice, setShowVoice] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechLang, setSpeechLang] = useState('en-IN')
  const recognitionRef = useRef(null)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)

  const [applications, setApplications] = useState([])
  const [loadingApplications, setLoadingApplications] = useState(false)
  const [applicationsError, setApplicationsError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  const [disputeJobId, setDisputeJobId] = useState(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeLoading, setDisputeLoading] = useState(false)
  const [disputeError, setDisputeError] = useState('')

  const isProfileIncomplete = !profile?.name || !workerProfile?.skills?.length

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  useEffect(() => {
    loadApplications()
  }, [])

  function startListening() {
    setVoiceError('')

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = speechLang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let final = ''
      let temp = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        } else {
          temp += event.results[i][0].transcript
        }
      }
      setTranscript(final.trim())
      setInterim(temp)
    }

    recognition.onerror = (event) => {
      setVoiceError(`Speech error: ${event.error}. You can type in the box below.`)
      setIsListening(false)
    }

    recognition.onend = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
  }

  async function processVoiceProfile() {
    const text = transcript.trim()
    if (text.length < 10) {
      setVoiceError('Please speak or type at least a few sentences about yourself, your skills, and experience.')
      return
    }

    setIsProcessing(true)
    setVoiceError('')

    const res = await fetch('/api/onboarding/voice-to-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    const data = await res.json()
    setIsProcessing(false)

    if (!res.ok) {
      setVoiceError(data.message || 'Failed to process')
      return
    }

    router.reload()
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function deleteResume() {
    if (!window.confirm('Are you sure you want to clear your resume? This will remove skills, bio, experience, and voice transcript.')) {
      return
    }

    const res = await fetch('/api/worker/profile', {
      method: 'DELETE',
    })

    const data = await res.json()

    if (!res.ok) {
      alert(data.message || 'Failed to clear resume')
      return
    }

    router.reload()
  }

  async function deleteAccount() {
    if (!window.confirm('Are you sure you want to permanently delete your account? This cannot be undone.')) {
      return
    }

    setIsDeletingAccount(true)
    const res = await fetch('/api/account/delete', { method: 'POST' })
    const data = await res.json()
    setIsDeletingAccount(false)

    if (!res.ok) {
      alert(data.message || 'Failed to delete account')
      return
    }

    router.push('/login')
  }

  async function loadApplications() {
    setLoadingApplications(true)
    setApplicationsError('')

    const res = await fetch('/api/worker/applications')
    const data = await res.json()
    setLoadingApplications(false)

    if (!res.ok) {
      setApplicationsError(data.message || 'Failed to load applications')
      return
    }

    setApplications(data.applications || [])
  }

  async function deleteApplication(applicationId) {
    if (!window.confirm('Are you sure you want to withdraw this application?')) {
      return
    }

    setDeletingId(applicationId)
    setApplicationsError('')

    const res = await fetch('/api/worker/applications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: applicationId }),
    })

    const data = await res.json()
    setDeletingId(null)

    if (!res.ok) {
      setApplicationsError(data.message || 'Failed to withdraw application')
      return
    }

    loadApplications()
  }

  function openDispute(jobId) {
    setDisputeJobId(jobId)
    setDisputeReason('')
    setDisputeError('')
  }

  function closeDispute() {
    setDisputeJobId(null)
    setDisputeReason('')
    setDisputeError('')
  }

  async function submitDispute() {
    const reason = disputeReason.trim()
    if (reason.length < 10) {
      setDisputeError('Please describe the issue in at least 10 characters.')
      return
    }

    setDisputeLoading(true)
    setDisputeError('')

    const res = await fetch('/api/disputes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: disputeJobId, reason }),
    })

    const data = await res.json()
    setDisputeLoading(false)

    if (!res.ok) {
      setDisputeError(data.message || 'Failed to raise dispute')
      return
    }

    closeDispute()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">Rozgar AI</h1>
          <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Worker Dashboard</h2>
            <p className="text-sm text-gray-600">Welcome back, {profile?.name || 'Worker'}.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/worker/profile')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200"
            >
              Edit Resume
            </button>
            <button
              onClick={() => router.push('/worker/jobs')}
              className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
            >
              Find Jobs
            </button>
          </div>
        </div>

        {isProfileIncomplete && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            Your resume is incomplete.{' '}
            <button
              onClick={() => router.push('/worker/profile')}
              className="font-medium underline hover:text-yellow-900"
            >
              Complete your profile
            </button>{' '}
            to get better job matches.
          </div>
        )}

        <div className="mb-6 bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Voice Resume</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Speak your name, skills, experience, and location to auto-update your resume.
              </p>
            </div>
            <button
              onClick={() => setShowVoice((s) => !s)}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              {showVoice ? 'Close' : '🎙️ Record Voice Resume'}
            </button>
          </div>

          {showVoice && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              {voiceError && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{voiceError}</div>}

              {speechSupported && (
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <button
                    onClick={isListening ? stopListening : startListening}
                    disabled={isProcessing}
                    className={`px-4 py-2 rounded text-white text-sm font-medium transition ${
                      isListening
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } disabled:opacity-50`}
                  >
                    {isListening ? 'Stop Recording' : 'Use Microphone'}
                  </button>
                  <select
                    value={speechLang}
                    onChange={(e) => setSpeechLang(e.target.value)}
                    disabled={isListening}
                    className="px-3 py-2 border border-gray-300 rounded text-sm bg-white disabled:opacity-50"
                  >
                    <option value="en-IN">English + Roman Urdu (en-IN)</option>
                    <option value="ur-PK">Urdu (ur-PK)</option>
                    <option value="en-US">English (en-US)</option>
                  </select>
                  {isListening && <span className="text-xs text-red-600 animate-pulse">Listening...</span>}
                </div>
              )}

              {(isListening || transcript || interim) && (
                <div className="mb-4 p-4 bg-gray-900 text-white rounded-lg min-h-[80px]">
                  <p className="text-base leading-relaxed whitespace-pre-wrap" dir="auto">
                    {transcript}
                    {interim && <span className="text-gray-400"> {interim}</span>}
                    {!transcript && !interim && <span className="text-gray-500 italic">Start speaking...</span>}
                  </p>
                </div>
              )}

              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="e.g. My name is Ahmed. I am an electrician with 5 years of experience. I live in Lahore."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-4"
              />

              <button
                onClick={processVoiceProfile}
                disabled={isProcessing || !transcript.trim()}
                className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isProcessing ? 'Processing with AI...' : 'Save to Resume'}
              </button>
            </div>
          )}
        </div>

        <div className="mb-6 bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">My Applications</h3>
              <p className="text-sm text-gray-600 mt-0.5">Jobs you applied to. Raise a dispute if something is wrong.</p>
            </div>
            <button
              onClick={loadApplications}
              disabled={loadingApplications}
              className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              {loadingApplications ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {applicationsError && <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{applicationsError}</div>}

          {applications.length === 0 && !loadingApplications && (
            <p className="text-sm text-gray-500">No applications yet. Go to Find Jobs to apply.</p>
          )}

          <div className="space-y-3">
            {applications.map((app) => (
              <div key={app.id} className="border border-gray-200 rounded p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-sm text-gray-900">{app.job?.title || 'Job'}</p>
                  <p className="text-xs text-gray-500">
                    {app.job?.customer?.name || 'Customer'} • {app.job?.location || 'No location'} • PKR {app.job?.budget || 'N/A'}
                  </p>
                  <span
                    className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded font-medium ${
                      app.status === 'selected'
                        ? 'bg-green-100 text-green-800'
                        : app.status === 'rejected'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {app.status}
                  </span>
                  {app.status === 'selected' && app.job?.customer?.phone && (
                    <p className="text-xs text-green-700 font-medium mt-1">
                      Customer phone: {app.job.customer.phone}
                    </p>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => openDispute(app.job?.id)}
                    className="text-xs px-2 py-1 bg-orange-50 text-orange-700 rounded hover:bg-orange-100 font-medium"
                  >
                    Raise Dispute
                  </button>
                  <button
                    onClick={() => deleteApplication(app.id)}
                    disabled={deletingId === app.id}
                    className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium disabled:opacity-50"
                  >
                    {deletingId === app.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-8 text-white">
              <div className="flex items-start gap-5">
                <div className="w-24 h-24 rounded-full bg-white/20 overflow-hidden flex items-center justify-center border-2 border-white/40 flex-shrink-0">
                  {workerProfile?.profile_pic_url ? (
                    <img src={workerProfile.profile_pic_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-3xl">👤</span>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">{profile?.name || 'No name set'}</h3>
                  <p className="text-blue-100 mt-1">
                    {workerProfile?.skills?.slice(0, 3).join(' • ') || 'General Labor'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-sm text-blue-50">
                    {profile?.phone && <span>📞 {profile.phone}</span>}
                    {workerProfile?.location && <span>📍 {workerProfile.location}</span>}
                    {workerProfile?.experience_years != null && (
                      <span>🛠️ {workerProfile.experience_years} yrs exp</span>
                    )}
                    {workerProfile?.total_reviews > 0 && (
                      <span>⭐ {workerProfile.average_rating} ({workerProfile.total_reviews} review{workerProfile.total_reviews > 1 ? 's' : ''})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                  Professional Summary
                </h4>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {workerProfile?.bio || profile?.bio || 'No professional summary added yet.'}
                </p>
              </section>

              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                  Skills
                </h4>
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

              {workerProfile?.voice_transcript && (
                <section>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                    Voice Resume
                  </h4>
                  <div className="bg-gray-50 border border-gray-200 rounded p-4">
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" dir="auto">
                      {workerProfile.voice_transcript}
                    </p>
                  </div>
                </section>
              )}

              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                  Trust & Verification
                </h4>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    workerProfile?.cnic_verified
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {workerProfile?.cnic_verified ? '✅ CNIC Verified' : '⏳ CNIC Not Verified'}
                </span>
              </section>

              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">
                  Reviews & Ratings
                </h4>
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">
                        {(reviews.reduce((a, r) => a + r.stars, 0) / reviews.length).toFixed(1)}
                      </span>
                      <span className="text-yellow-500">{'★'.repeat(Math.round(reviews.reduce((a, r) => a + r.stars, 0) / reviews.length))}</span>
                      <span className="text-sm text-gray-500">({reviews.length} review{reviews.length > 1 ? 's' : ''})</span>
                    </div>
                    {reviews.map((review) => (
                      <div key={review.id} className="bg-gray-50 border border-gray-200 rounded p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{review.reviewer_name}</span>
                          <span className="text-xs text-yellow-600 font-medium">{'★'.repeat(review.stars)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{review.job_title}</p>
                        {review.review_text && (
                          <p className="text-sm text-gray-700 mt-2 leading-relaxed">{review.review_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">No reviews yet.</p>
                )}
              </section>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-4">AI Skill Score</h3>
              {workerProfile?.ai_skill_score && Object.keys(workerProfile.ai_skill_score).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(workerProfile.ai_skill_score).map(([skill, score]) => (
                    <div key={skill} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-700 w-20 font-medium truncate">{skill}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-600 w-8 text-right">{score}%</span>
                    </div>
                  ))}
                  <button
                    onClick={() => router.push('/worker/assessment')}
                    className="w-full mt-4 py-2 px-4 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    Retake Assessment
                  </button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3">No assessment taken yet.</p>
                  <button
                    onClick={() => router.push('/worker/assessment')}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                  >
                    Start AI Assessment
                  </button>
                </div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-5">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => router.push('/worker/profile')}
                  className="w-full text-left px-4 py-2 rounded text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                >
                  ✏️ Edit Resume
                </button>
                <button
                  onClick={() => router.push('/worker/jobs')}
                  className="w-full text-left px-4 py-2 rounded text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                >
                  🔍 Find Matching Jobs
                </button>
                <button
                  onClick={() => router.push('/worker/assessment')}
                  className="w-full text-left px-4 py-2 rounded text-sm font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                >
                  🧠 AI Skill Assessment
                </button>
                <button
                  onClick={deleteResume}
                  className="w-full text-left px-4 py-2 rounded text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100"
                >
                  🗑️ Clear Resume
                </button>
                <button
                  onClick={deleteAccount}
                  disabled={isDeletingAccount}
                  className="w-full text-left px-4 py-2 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isDeletingAccount ? 'Deleting Account...' : '⚠️ Delete Account'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {disputeJobId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-5">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide mb-2">Raise Dispute</h3>
              <p className="text-sm text-gray-600 mb-4">
                Describe the issue with this job. Admin will review and contact you.
              </p>

              {disputeError && (
                <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">{disputeError}</div>
              )}

              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="e.g. The customer refused to pay after the work was done..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
              />

              <div className="flex gap-2 justify-end">
                <button
                  onClick={closeDispute}
                  disabled={disputeLoading}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitDispute}
                  disabled={disputeLoading || disputeReason.trim().length < 10}
                  className="px-4 py-2 bg-orange-600 text-white rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                >
                  {disputeLoading ? 'Submitting...' : 'Submit Dispute'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
