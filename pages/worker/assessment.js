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

export default function Assessment({ profile, workerProfile }) {
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState([])
  const [scores, setScores] = useState(workerProfile?.ai_skill_score || null)
  const [feedback, setFeedback] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

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

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">AI Skill Assessment</h2>
            <button
              onClick={() => router.push('/worker/profile')}
              className="text-sm text-blue-600 hover:underline"
            >
              Back to Skill Passport
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-6">
            AI will ask 3 practical questions based on your skills: {workerProfile?.skills?.join(', ') || 'general labor'}.
          </p>

          {scores && Object.keys(scores).length > 0 && (
            <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded">
              <h3 className="font-medium text-green-800 mb-3">Assessment Result</h3>
              <div className="space-y-2 mb-3">
                {Object.entries(scores).map(([skill, score]) => (
                  <div key={skill} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-700 w-28">{skill}</span>
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div className="bg-green-600 h-2 rounded-full" style={{ width: `${score}%` }} />
                    </div>
                    <span className="text-xs text-gray-600 w-8">{score}</span>
                  </div>
                ))}
              </div>
              {feedback && <p className="text-sm text-gray-700 italic">{feedback}</p>}
            </div>
          )}

          {questions.length === 0 ? (
            <div className="space-y-3">
              <button
                onClick={startAssessment}
                disabled={loading}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
              >
                {loading ? 'Preparing Questions...' : scores ? 'Retake Assessment' : 'Start Assessment'}
              </button>
              {scores && (
                <button
                  onClick={() => router.push('/worker/jobs')}
                  className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-medium"
                >
                  Find Matching Jobs
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={i}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {i + 1}. {q.question}
                  </label>
                  <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded mb-2">
                    {q.skill}
                  </span>
                  <textarea
                    value={answers[i] || ''}
                    onChange={(e) => updateAnswer(i, e.target.value)}
                    rows={3}
                    placeholder="Type your answer here..."
                    className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
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
