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

  let { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return { redirect: { destination: '/onboarding', permanent: false } }
  }

  if (profile.role !== 'worker') {
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

  return {
    props: {
      profile: profile || null,
      workerProfile: workerProfile || null,
    },
  }
}

export default function Assessment({ profile, workerProfile }) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [scores, setScores] = useState(workerProfile?.ai_skill_score || null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechLang, setSpeechLang] = useState('en-IN')
  const [recordingIndex, setRecordingIndex] = useState(null)
  const [interimAnswer, setInterimAnswer] = useState('')
  const recognitionRef = useRef(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  function startRecording(index) {
    setError('')
    setInterimAnswer('')

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.lang = speechLang
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onresult = (event) => {
      let final = answers[index] || ''
      let temp = ''
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        } else {
          temp += event.results[i][0].transcript
        }
      }
      updateAnswer(index, final.trim())
      setInterimAnswer(temp)
    }

    recognition.onerror = (event) => {
      setError(`Speech error: ${event.error}. You can type your answer below.`)
      stopRecording()
    }

    recognition.onend = () => {
      setRecordingIndex(null)
      setInterimAnswer('')
    }

    recognitionRef.current = recognition
    recognition.start()
    setRecordingIndex(index)
  }

  function stopRecording() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setRecordingIndex(null)
    setInterimAnswer('')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function startAssessment() {
    setLoading(true)
    setError('')
    setScores(null)
    setFeedback('')

    const res = await fetch('/api/worker/assessment', { method: 'POST' })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.message || 'Failed to start assessment')
      return
    }

    setQuestions(data.questions || [])
    setAnswers(new Array(data.questions?.length || 0).fill(''))
  }

  async function submitAssessment() {
    if (answers.some(a => !a.trim())) {
      setError('Please answer all questions')
      return
    }

    setLoading(true)
    setError('')

    const res = await fetch('/api/worker/assessment', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questions, answers }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.message || 'Failed to submit assessment')
      return
    }

    setScores(data.scores)
    setFeedback(data.feedback)
    setQuestions([])
  }

  function updateAnswer(index, value) {
    setAnswers(prev => {
      const next = [...prev]
      next[index] = value
      return next
    })
  }

  return (
    <div className="min-h-screen bg-page-bg">
      <nav className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">Rozgar AI</h1>
          <button onClick={handleLogout} className="text-sm text-muted hover:text-primary">
            Sign Out
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">AI Skill Assessment</h2>
            <button
              onClick={() => router.push('/worker/dashboard')}
              className="text-sm text-primary hover:underline"
            >
              Back to Dashboard
            </button>
          </div>

          <div className="mb-6 p-4 bg-navy-50 border border-navy-200 rounded">
            <h3 className="font-medium text-navy-950 mb-1">{profile?.name || 'Worker Profile'}</h3>
            <p className="text-sm text-navy-900">
              Skills: {workerProfile?.skills?.join(', ') || 'general labor'}
            </p>
            {workerProfile?.experience_years != null && (
              <p className="text-sm text-navy-900 mt-1">
                Experience: {workerProfile.experience_years} years
              </p>
            )}
          </div>

          {scores && Object.keys(scores).length > 0 && (
            <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded">
              <h3 className="font-medium text-green-800 mb-3">Assessment Result</h3>
              <div className="space-y-2 mb-3">
                {Object.entries(scores).map(([skill, score]) => (
                  <div key={skill} className="flex items-center gap-3 text-sm">
                    <span className="text-body w-28">{skill}</span>
                    <div className="flex-1 bg-navy-100 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-xs text-muted w-8">{score}</span>
                  </div>
                ))}
              </div>
              {feedback && <p className="text-sm text-body italic">{feedback}</p>}
            </div>
          )}

          {speechSupported && questions.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3 p-3 bg-navy-50 border border-navy-200 rounded">
              <span className="text-sm text-navy-950 font-medium">Answer by voice:</span>
              <select
                value={speechLang}
                onChange={(e) => setSpeechLang(e.target.value)}
                disabled={recordingIndex !== null}
                className="px-3 py-1.5 border border-line-strong rounded text-sm bg-white disabled:opacity-50"
              >
                <option value="en-IN">English + Roman Urdu (en-IN)</option>
                <option value="ur-PK">Urdu (ur-PK)</option>
                <option value="en-US">English (en-US)</option>
              </select>
              <span className="text-xs text-primary">Click the mic button next to each answer to record.</span>
            </div>
          )}

          {questions.length === 0 ? (
            <div className="space-y-3">
              <button
                onClick={startAssessment}
                disabled={loading}
                className="w-full py-2 px-4 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 text-sm font-medium"
              >
                {loading ? 'Preparing Questions...' : scores ? 'Retake Assessment' : 'Start Assessment'}
              </button>
              {scores && (
                <>
                  <button
                    onClick={() => router.push('/worker/jobs')}
                    className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                  >
                    Find Matching Jobs
                  </button>
                  <button
                    onClick={() => router.push('/worker/dashboard')}
                    className="w-full py-2 px-4 bg-navy-100 text-body rounded hover:bg-navy-200 text-sm font-medium"
                  >
                    Go to Dashboard
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-body mb-1">
                    {i + 1}. {q.question}
                  </label>
                  <span className="inline-block text-xs bg-navy-100 text-navy-900 px-2 py-0.5 rounded mb-2">
                    {q.skill}
                  </span>
                  <div className="relative">
                    <textarea
                      value={answers[i] || ''}
                      onChange={(e) => updateAnswer(i, e.target.value)}
                      rows={3}
                      placeholder="Type your answer here or use the mic..."
                      className="w-full px-3 py-2 pr-10 border border-line-strong rounded focus:outline-none focus:ring-2 focus:ring-accent text-sm"
                    />
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={() => (recordingIndex === i ? stopRecording() : startRecording(i))}
                        disabled={loading || (recordingIndex !== null && recordingIndex !== i)}
                        className={`absolute right-2 bottom-2 p-1.5 rounded-full transition disabled:opacity-40 ${
                          recordingIndex === i
                            ? 'bg-red-100 text-red-600 animate-pulse'
                            : 'bg-navy-100 text-muted hover:bg-navy-100 hover:text-primary'
                        }`}
                        title={recordingIndex === i ? 'Stop recording' : 'Record answer'}
                      >
                        {recordingIndex === i ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <rect x="6" y="6" width="8" height="8" rx="1" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                  {recordingIndex === i && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-red-600">
                      <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      Recording... {interimAnswer && <span className="text-muted">{interimAnswer}</span>}
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={submitAssessment}
                disabled={loading}
                className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
              >
                {loading ? 'Evaluating...' : 'Submit Answers'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
