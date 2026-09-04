import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const message = router.query.message

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error, data } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profile?.role === 'admin') {
      router.push('/admin')
    } else if (profile?.role === 'customer') {
      router.push('/customer/dashboard')
    } else {
      router.push('/worker/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow relative">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
          className="absolute top-4 left-4 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-center mb-6">Rozgar AI</h1>
        <h2 className="text-lg text-center text-gray-600 mb-8">Sign In</h2>

        {message === 'check-email' && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">
            Account created. Please check your email to confirm before signing in.
          </div>
        )}

        {message === 'admin-only' && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">
            Admin access required.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <label className="mt-2 flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showPassword}
                onChange={(e) => setShowPassword(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Show password
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4">
          <Link
            href="/signup"
            className="block w-full py-2 px-4 text-center border border-blue-600 text-blue-600 rounded hover:bg-blue-50"
          >
            Create Account
          </Link>
        </div>

        <p className="mt-4 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-blue-600 hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  )
}
