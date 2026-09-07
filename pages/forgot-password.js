import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseClient'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess('Password reset link sent. Please check your email.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg mesh-gradient px-4">
      <div className="w-full max-w-md p-8 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 relative animate-fade-in-up">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/login'))}
          className="absolute top-4 left-4 px-3 py-1.5 text-sm bg-navy-100 text-body rounded hover:bg-navy-200 flex items-center gap-1 transition-all hover:-translate-y-0.5"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-extrabold text-center mb-2 text-gradient">Rozgar AI</h1>
        <h2 className="text-lg text-center text-muted mb-8">Reset Password</h2>

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{success}</div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-body mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-line-strong rounded focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="w-full py-2 px-4 btn-gradient rounded text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Remember your password?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
