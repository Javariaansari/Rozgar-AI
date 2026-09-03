import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabaseClient'

export default function Onboarding() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [speechLang, setSpeechLang] = useState('en-IN')
  const recognitionRef = useRef(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  useEffect(() => {
    setSpeechSupported('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  }, [])

  function startListening() {
    setError('')
    setResult(null)
    setIsSaved(false)

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
      setError(`Speech error: ${event.error}. You can type in the transcript box below.`)
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

  async function processProfile() {
    const text = transcript.trim()
    if (text.length < 10) {
      setError('Please speak or type at least a few sentences about yourself, your skills, and experience.')
      return
    }

    setIsProcessing(true)
    setError('')

    const res = await fetch('/api/onboarding/voice-to-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })

    const data = await res.json()
    setIsProcessing(false)

    if (!res.ok) {
      setError(data.message || 'Failed to process')
      return
    }

    setResult(data.extracted)
    setIsSaved(true)
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-2">Profile Onboarding</h2>
          <p className="text-sm text-gray-600 mb-6">
            Tell us about yourself — your name, skills, experience, and location. Type below, or use the mic button to speak.
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

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
              {!isListening && (transcript || interim) && (
                <span className="text-xs text-gray-500">{transcript ? 'Transcript captured' : 'Capturing...'}</span>
              )}
            </div>
          )}

          {(isListening || transcript || interim) && (
            <div className="mb-6 p-4 bg-gray-900 text-white rounded-lg min-h-[96px]">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-xs font-medium text-gray-300">
                  {isListening ? 'Live transcript' : 'Transcript preview'}
                </span>
              </div>
              <p className="text-base leading-relaxed whitespace-pre-wrap" dir="auto">
                {transcript}
                {interim && <span className="text-gray-400"> {interim}</span>}
                {!transcript && !interim && <span className="text-gray-500 italic">Start speaking...</span>}
              </p>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-600 mb-1">Transcript</label>
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="e.g. My name is Ahmed. I am an electrician with 5 years of experience. I live in Lahore and can do wiring, switchboard installation, and fan repair."
              className="w-full h-40 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <button
            onClick={processProfile}
            disabled={isProcessing || !transcript.trim()}
            className="w-full py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isProcessing ? 'Processing with AI...' : 'Save Profile'}
          </button>

          {isSaved && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded">
              <p className="text-sm text-blue-800 font-medium mb-2">Profile saved successfully!</p>
              <button
                onClick={() => router.push('/worker/assessment')}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium"
              >
                Next: AI Skill Assessment
              </button>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-8 text-white">
              <h3 className="text-2xl font-bold">{result.name || 'Your Skill Passport'}</h3>
              <p className="text-blue-100 mt-1">
                {result.skills?.slice(0, 3).join(' • ') || 'General Labor'}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-blue-50">
                {result.location && <span>Location: {result.location}</span>}
              </div>
            </div>

            <div className="p-6 space-y-6">
              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">Professional Summary</h4>
                <p className="text-sm text-gray-700 leading-relaxed">{result.bio || 'No summary provided.'}</p>
              </section>

              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">Skills</h4>
                <div className="flex flex-wrap gap-2">
                  {result.skills?.length > 0 ? result.skills.map((skill, i) => (
                    <span key={i} className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">{skill}</span>
                  )) : (
                    <span className="text-sm text-gray-400">No skills extracted</span>
                  )}
                </div>
              </section>

              <section>
                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">Experience</h4>
                <div className="text-sm text-gray-700">
                  {result.experience_years != null ? (
                    <>
                      <p className="font-medium">{result.experience_years} years</p>
                      <p className="text-gray-600 mt-1">Hands-on experience in {result.skills?.join(', ') || 'the listed skills'}.</p>
                    </>
                  ) : (
                    <p className="text-gray-500">Experience not specified.</p>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
