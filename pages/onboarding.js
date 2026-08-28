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
  const [manualMode, setManualMode] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
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
    recognition.lang = 'en-US'
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
      setError(`Speech error: ${event.error}. You can type manually below.`)
      setIsListening(false)
      setManualMode(true)
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
          <h2 className="text-lg font-semibold mb-2">Voice Onboarding</h2>
          <p className="text-sm text-gray-600 mb-6">
            Tell us about yourself — your name, skills, experience, and location. Speak naturally or type below.
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}

          {speechSupported && !manualMode && (
            <div className="flex flex-col items-center mb-6">
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isProcessing}
                className={`w-24 h-24 rounded-full flex items-center justify-center text-white text-sm font-medium transition-all ${
                  isListening
                    ? 'bg-red-500 animate-pulse hover:bg-red-600'
                    : 'bg-blue-600 hover:bg-blue-700'
                } disabled:opacity-50`}
              >
                {isListening ? 'Stop' : 'Start'}
              </button>
              <p className="mt-3 text-xs text-gray-500">
                {isListening ? 'Listening... speak now' : 'Tap to start recording'}
              </p>
              <button
                onClick={() => setManualMode(true)}
                className="mt-2 text-xs text-blue-600 hover:underline"
              >
                Type manually instead
              </button>
            </div>
          )}

          {(!speechSupported || manualMode) && (
            <div className="mb-6">
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="e.g. My name is Ahmed. I am an electrician with 5 years of experience. I work in Lahore and can do wiring, switchboard installation, and fan repair."
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}

          {speechSupported && !manualMode && (transcript || interim) && (
            <div className="mb-6 p-4 bg-gray-50 rounded">
              <p className="text-sm font-medium text-gray-700 mb-1">Transcript:</p>
              <p className="text-sm text-gray-900">{transcript}</p>
              {interim && <p className="text-sm text-gray-400 italic">{interim}</p>}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={processProfile}
              disabled={isProcessing || (!transcript.trim() && !manualMode)}
              className="flex-1 py-2 px-4 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {isProcessing ? 'Processing with AI...' : 'Save Profile'}
            </button>
            {isSaved && (
              <button
                onClick={() => router.push('/worker/profile')}
                className="flex-1 py-2 px-4 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm font-medium"
              >
                View Profile
              </button>
            )}
          </div>
        </div>

        {result && (
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-3">AI Extracted Profile</h3>
            <div className="space-y-2 text-sm">
              {result.name && <p><span className="font-medium text-gray-700">Name:</span> {result.name}</p>}
              {result.skills?.length > 0 && (
                <p>
                  <span className="font-medium text-gray-700">Skills:</span>{' '}
                  {result.skills.map((s, i) => (
                    <span key={i} className="inline-block bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs mr-1 mb-1">{s}</span>
                  ))}
                </p>
              )}
              {result.experience_years != null && (
                <p><span className="font-medium text-gray-700">Experience:</span> {result.experience_years} years</p>
              )}
              {result.bio && <p><span className="font-medium text-gray-700">Bio:</span> {result.bio}</p>}
              {result.location && <p><span className="font-medium text-gray-700">Location:</span> {result.location}</p>}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
