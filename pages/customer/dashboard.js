import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabaseClient'

export async function getServerSideProps(context) {
  const { createClient: createServerClient } = await import('@/lib/supabaseServer')
  const supabase = createServerClient(context.req, context.res)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'customer') {
    return { redirect: { destination: '/login', permanent: false } }
  }

  let { data: customerProfile } = await supabase
    .from('customer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!customerProfile) {
    const { data: newCustomerProfile, error: createError } = await supabase
      .from('customer_profiles')
      .insert({ user_id: user.id })
      .select('*')
      .single()
    if (createError) throw createError
    customerProfile = newCustomerProfile
  }

  return {
    props: {
      profile: profile || null,
      customerProfile: customerProfile || null,
    },
  }
}

export default function CustomerDashboard({ profile, customerProfile }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rating, setRating] = useState({})
  const [review, setReview] = useState({})

  const [showVoiceJob, setShowVoiceJob] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [voiceError, setVoiceError] = useState('')
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechLang, setSpeechLang] = useState('en-IN')
  const [extractedJob, setExtractedJob] = useState(null)
  const [isPosting, setIsPosting] = useState(false)
  const [editingJobId, setEditingJobId] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const recognitionRef = useRef(null)

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadJobs()
  }, [])

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function startListening() {
    setVoiceError('')
    setExtractedJob(null)

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

  async function processVoiceJob() {
    const text = transcript.trim()
    if (text.length < 10) {
      setVoiceError('Please speak or type at least a few sentences about the job.')
      return
    }

    setIsProcessing(true)
    setVoiceError('')
    setExtractedJob(null)

    const res = await fetch('/api/customer/voice-to-job', {
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

    setExtractedJob(data.extracted || null)
  }

  async function postExtractedJob() {
    if (!extractedJob) return

    setIsPosting(true)
    setError('')

    const res = await fetch('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extractedJob),
    })

    const data = await res.json()
    setIsPosting(false)

    if (!res.ok) {
      setError(data.message || 'Failed to post job')
      return
    }

    setShowVoiceJob(false)
    setTranscript('')
    setExtractedJob(null)
    loadJobs()
  }

  async function loadJobs() {
    setLoading(true)
    setError('')

    const res = await fetch('/api/customer/jobs')
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.message || 'Failed to load jobs')
      return
    }

    setJobs(data.jobs || [])
  }

  async function updateApplication(applicationId, status) {
    setError('')
    const res = await fetch('/api/customer/applications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: applicationId, status }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.message || 'Update failed')
      return
    }

    loadJobs()
  }

  async function completeJob(jobId) {
    setError('')
    const stars = Number(rating[jobId])
    if (!stars || stars < 1 || stars > 5) {
      setError('Please select a rating between 1 and 5')
      return
    }

    const res = await fetch('/api/customer/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        job_id: jobId,
        stars,
        review_text: review[jobId] || '',
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.message || 'Failed to complete job')
      return
    }

    loadJobs()
  }

  function startEdit(job) {
    setEditingJobId(job.id)
    setEditForm({
      title: job.title || '',
      category: job.category || '',
      description: job.description || '',
      budget: job.budget || '',
      location: job.location || '',
    })
  }

  function cancelEdit() {
    setEditingJobId(null)
    setEditForm({})
  }

  async function saveJob(jobId) {
    setError('')
    setIsSavingEdit(true)

    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })

    const data = await res.json()
    setIsSavingEdit(false)

    if (!res.ok) {
      setError(data.message || 'Failed to update job')
      return
    }

    setEditingJobId(null)
    setEditForm({})
    loadJobs()
  }

  async function deleteJob(jobId) {
    if (!window.confirm('Are you sure you want to delete this job?')) {
      return
    }

    setError('')
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'DELETE',
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.message || 'Failed to delete job')
      return
    }

    loadJobs()
  }

  const statusBadge = (status) => {
    const styles = {
      open: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-gray-100 text-gray-800',
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">Rozgar AI</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/customer/post-job')}
              className="text-sm text-blue-600 hover:underline"
            >
              Post New Job
            </button>
            <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Customer Dashboard</h2>
            <p className="text-sm text-gray-600">Manage your jobs and review applicants.</p>
          </div>
          <button
            onClick={loadJobs}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load My Jobs'}
          </button>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        <div className="mb-6 bg-white rounded-lg shadow p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Post Job by Voice</h3>
              <p className="text-sm text-gray-600 mt-0.5">
                Speak the job title, work details, budget, and location. AI will create the job posting.
              </p>
            </div>
            <button
              onClick={() => setShowVoiceJob((s) => !s)}
              className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
            >
              {showVoiceJob ? 'Close' : '🎙️ Post Job by Voice'}
            </button>
          </div>

          {showVoiceJob && (
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
                placeholder="e.g. I need an electrician for home wiring in Lahore. Budget is 5000 rupees."
                className="w-full h-32 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-4"
              />

              <button
                onClick={processVoiceJob}
                disabled={isProcessing || !transcript.trim()}
                className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isProcessing ? 'AI is extracting details...' : 'Extract Job Details'}
              </button>

              {extractedJob && (
                <div className="mt-5 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <h4 className="text-sm font-bold text-gray-900 mb-3">Review & Confirm Job</h4>
                  <div className="grid gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                      <input
                        value={extractedJob.title || ''}
                        onChange={(e) => setExtractedJob((j) => ({ ...j, title: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                      <input
                        value={extractedJob.category || ''}
                        onChange={(e) => setExtractedJob((j) => ({ ...j, category: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                      <textarea
                        value={extractedJob.description || ''}
                        onChange={(e) => setExtractedJob((j) => ({ ...j, description: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Budget (PKR)</label>
                        <input
                          type="number"
                          value={extractedJob.budget || ''}
                          onChange={(e) => setExtractedJob((j) => ({ ...j, budget: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                        <input
                          value={extractedJob.location || ''}
                          onChange={(e) => setExtractedJob((j) => ({ ...j, location: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={postExtractedJob}
                    disabled={isPosting || !extractedJob.title?.trim()}
                    className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                  >
                    {isPosting ? 'Posting...' : 'Confirm & Post Job'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {jobs.length === 0 && !loading && (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">
            No jobs posted yet.{' '}
            <button onClick={() => router.push('/customer/post-job')} className="text-blue-600 hover:underline">
              Post your first job
            </button>
          </div>
        )}

        <div className="space-y-6">
          {jobs.map((job) => {
            const selectedApplicant = job.applications?.find((a) => a.status === 'selected')
            const isCompleted = job.status === 'completed'

            return (
              <div key={job.id} className="bg-white rounded-lg shadow overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  {editingJobId === job.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                        <input
                          value={editForm.title}
                          onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
                        <input
                          value={editForm.category}
                          onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Budget (PKR)</label>
                          <input
                            type="number"
                            value={editForm.budget}
                            onChange={(e) => setEditForm((f) => ({ ...f, budget: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Location</label>
                          <input
                            value={editForm.location}
                            onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => saveJob(job.id)}
                          disabled={isSavingEdit || !editForm.title?.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                        >
                          {isSavingEdit ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={isSavingEdit}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded text-sm font-medium hover:bg-gray-300 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-medium text-gray-900">{job.title}</h3>
                          <p className="text-sm text-gray-500 mt-0.5">{job.location || 'No location'} • PKR {job.budget || 'N/A'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {job.status === 'open' && (
                            <button
                              onClick={() => startEdit(job)}
                              className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 font-medium"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => deleteJob(job.id)}
                            className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 font-medium"
                          >
                            Delete
                          </button>
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusBadge(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-3">{job.description || 'No description'}</p>
                    </>
                  )}
                </div>

                <div className="p-5">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3">
                    Applicants ({job.applications?.length || 0})
                  </h4>

                  {job.applications?.length === 0 && (
                    <p className="text-sm text-gray-500">No applications yet.</p>
                  )}

                  <div className="space-y-3">
                    {job.applications?.map((app) => (
                      <div key={app.id} className="border border-gray-200 rounded p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm text-gray-900">
                              {app.worker?.name || 'Worker'}
                            </p>
                            <p className="text-xs text-gray-500">
                              {app.worker_profile?.skills?.join(', ') || 'general labor'} •{' '}
                              {app.worker_profile?.experience_years != null
                                ? `${app.worker_profile.experience_years} yrs exp`
                                : 'experience not listed'}
                            </p>
                            {app.worker_profile?.ai_skill_score && (
                              <p className="text-xs text-gray-500 mt-1">
                                AI Score:{' '}
                                {Object.entries(app.worker_profile.ai_skill_score)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(', ')}
                              </p>
                            )}
                          </div>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              app.status === 'selected'
                                ? 'bg-green-100 text-green-800'
                                : app.status === 'rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {app.status}
                          </span>
                        </div>

                        {job.status === 'open' && app.status === 'applied' && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={() => updateApplication(app.id, 'selected')}
                              className="px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700"
                            >
                              Select
                            </button>
                            <button
                              onClick={() => updateApplication(app.id, 'rejected')}
                              className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs font-medium hover:bg-gray-300"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {job.status === 'open' && selectedApplicant && (
                    <div className="mt-5 pt-5 border-t border-gray-100">
                      <p className="text-sm font-medium text-gray-900 mb-2">
                        Mark job as completed and rate {selectedApplicant.worker?.name || 'the worker'}
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <select
                          value={rating[job.id] || ''}
                          onChange={(e) => setRating((r) => ({ ...r, [job.id]: e.target.value }))}
                          className="px-3 py-2 border border-gray-300 rounded text-sm"
                        >
                          <option value="">Rate</option>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <option key={s} value={s}>
                              {s} star{s > 1 ? 's' : ''}
                            </option>
                          ))}
                        </select>
                        <input
                          value={review[job.id] || ''}
                          onChange={(e) => setReview((r) => ({ ...r, [job.id]: e.target.value }))}
                          placeholder="Write a review (optional)"
                          className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded text-sm"
                        />
                        <button
                          onClick={() => completeJob(job.id)}
                          className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                        >
                          Complete Job
                        </button>
                      </div>
                    </div>
                  )}

                  {isCompleted && (
                    <p className="mt-4 text-sm text-green-700 font-medium">This job has been completed.</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}
