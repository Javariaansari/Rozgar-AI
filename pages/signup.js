import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { createClient } from '@/lib/supabaseClient'

export default function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('worker')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const phoneRegex = /^(\+92|0|92)\d{10}$/

  async function handleSignup(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!phoneRegex.test(phone)) {
      setError('Please enter a valid phone number (e.g. +923001234567 or 03001234567)')
      setLoading(false)
      return
    }

    const { error, data } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role, phone },
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data?.session) {
      router.push('/login?message=check-email')
      return
    }

    if (role === 'customer') {
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
        <h2 className="text-lg text-center text-gray-600 mb-8">Create Account</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
        )}

        <form onSubmit={handleSignup} className="space-y-4">
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

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +923001234567"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">I am a</label>
            <div className="flex gap-4">
              <label className={`flex-1 flex items-center justify-center p-3 border rounded cursor-pointer transition ${
                role === 'worker'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="worker"
                  checked={role === 'worker'}
                  onChange={(e) => setRole(e.target.value)}
                  className="sr-only"
                />
                <span className="font-medium">Worker</span>
              </label>
              <label className={`flex-1 flex items-center justify-center p-3 border rounded cursor-pointer transition ${
                role === 'customer'
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  name="role"
                  value="customer"
                  checked={role === 'customer'}
                  onChange={(e) => setRole(e.target.value)}
                  className="sr-only"
                />
                <span className="font-medium">Customer</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}
