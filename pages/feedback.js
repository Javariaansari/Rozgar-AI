import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseClient'

export default function Feedback() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('customer')
  const [stars, setStars] = useState(5)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechLang, setSpeechLang] = useState('en-IN')
  const [loadingUser, setLoadingUser] = useState(true)
  const [user, setUser] = useState(null)
  const recognitionRef = useRef(null)
  const supabase = createClient()

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoadingUser(false)
      if (user?.user_metadata?.name) {
        setName(user.user_metadata.name)
      }
    })
  }, [])

  function startListening() {
    setError('')

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
      setError(`Speech error: ${event.error}. Aap neeche text box mein type kar sakte hain.`)
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

  async function handleSubmit(e) {
    e.preventDefault()
    const content = transcript.trim()

    if (!name.trim()) {
      setError('Name zaroori hai')
      return
    }

    if (content.length < 10) {
      setError('Please apna feedback detail mein batayein.')
      return
    }

    setIsSubmitting(true)
    setError('')

    const res = await fetch('/api/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        role,
        content,
        stars,
        voice_transcript: content,
      }),
    })

    const data = await res.json()
    setIsSubmitting(false)

    if (!res.ok) {
      if (res.status === 401) {
        setError('Please pehle login karein.')
      } else {
        setError(data.message || 'Feedback submit nahi ho saka')
      }
      return
    }

    setSubmitted(true)
    setTranscript('')
  }

  if (loadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 text-sm">
        Loading...
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-lg shadow p-6 max-w-md w-full text-center">
          <h1 className="text-lg font-semibold mb-2">Apna Feedback Dein</h1>
          <p className="text-sm text-gray-600 mb-4">
            Apna experience share karne ke liye login karein.
          </p>
          <Link
            href="/login"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
          >
            Login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <Link href="/" className="text-xl font-bold text-blue-700">
            Rozgar AI
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Apna Feedback Dein</h1>
          <p className="text-sm text-gray-600 mb-6">
            Apna experience batayein — voice ya text ke zariye. Admin review ke baad yeh homepage par show hoga.
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
          )}

          {submitted ? (
            <div className="p-4 bg-green-50 text-green-800 rounded text-sm">
              <p className="font-medium">Shukriya! Aapka feedback submit ho gaya hai.</p>
              <p className="mt-1">Admin review ke baad yeh homepage par show hoga.</p>
              <Link href="/" className="inline-block mt-4 text-blue-600 hover:underline">
                Home par wapas jayein
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aapka naam"
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Aap hain</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="customer">Customer</option>
                  <option value="worker">Worker</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStars(s)}
                      className={`text-2xl leading-none ${s <= stars ? 'text-yellow-400' : 'text-gray-300'}`}
                      aria-label={`Rate ${s} stars`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {speechSupported && (
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={isListening ? stopListening : startListening}
                    disabled={isSubmitting}
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
                  {isListening && (
                    <span className="text-xs text-red-600 animate-pulse">Listening...</span>
                  )}
                </div>
              )}

              {(isListening || transcript || interim) && (
                <div className="p-4 bg-gray-900 text-white rounded-lg min-h-[96px]">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        isListening ? 'bg-red-500 animate-pulse' : 'bg-green-500'
                      }`}
                    />
                    <span className="text-xs font-medium text-gray-300">
                      {isListening ? 'Live transcript' : 'Transcript preview'}
                    </span>
                  </div>
                  <p className="text-base leading-relaxed whitespace-pre-wrap" dir="auto">
                    {transcript}
                    {interim && <span className="text-gray-400"> {interim}</span>}
                    {!transcript && !interim && (
                      <span className="text-gray-500 italic">Start speaking...</span>
                    )}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Feedback</label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Apna experience batayein..."
                  className="w-full h-40 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !transcript.trim()}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
