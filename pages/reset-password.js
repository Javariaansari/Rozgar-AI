import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseClient'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setRecoveryReady(true)
      }
    })

    return () => {
      listener?.subscription?.unsubscribe()
    }
  }, [supabase])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSuccess('Password updated successfully. Redirecting to login...')
    setTimeout(() => router.push('/login?message=password-reset'), 1500)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow relative">
        <button
          type="button"
          onClick={() => router.push('/login')}
          className="absolute top-4 left-4 px-3 py-1.5 text-sm bg-navy-100 text-body rounded hover:bg-navy-200 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-center mb-6">Rozgar AI</h1>
        <h2 className="text-lg text-center text-muted mb-8">Create New Password</h2>

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{success}</div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
        )}

        {!recoveryReady && !success && (
          <div className="mb-4 p-3 bg-navy-50 text-primary rounded text-sm">
            Verifying reset link...
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-body mb-1">
              New Password
            </label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-line-strong rounded focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-body mb-1">
              Confirm New Password
            </label>
            <input
              id="confirmPassword"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-line-strong rounded focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-muted cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-line-strong text-primary focus:ring-accent"
              />
              Show password
            </label>
          </div>

          <button
            type="submit"
            disabled={loading || !recoveryReady}
            className="w-full py-2 px-4 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted">
          Back to{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
