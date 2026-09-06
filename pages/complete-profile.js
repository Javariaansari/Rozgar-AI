import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@/lib/supabaseClient'

export default function CompleteProfile() {
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('worker')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const phoneRegex = /^(\+92|0|92)\d{10}$/

  useEffect(() => {
    async function init() {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, phone')
        .eq('id', user.id)
        .single()

      if (profile?.role && profile?.phone) {
        redirectByRole(profile.role)
        return
      }

      if (profile?.role) {
        setRole(profile.role)
      } else if (typeof window !== 'undefined') {
        const pendingRole = window.sessionStorage.getItem('pending_role')
        if (pendingRole) setRole(pendingRole)
      }

      if (profile?.phone) {
        setPhone(profile.phone)
      } else if (typeof window !== 'undefined') {
        const pendingPhone = window.sessionStorage.getItem('pending_phone')
        if (pendingPhone) setPhone(pendingPhone)
      }

      setLoading(false)
    }

    init()
  }, [router, supabase])

  function redirectByRole(roleName) {
    if (roleName === 'admin') {
      router.push('/admin')
    } else if (roleName === 'customer') {
      router.push('/customer/dashboard')
    } else {
      router.push('/worker/dashboard')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!phoneRegex.test(phone)) {
      setError('Please enter a valid phone number (e.g. +923001234567 or 03001234567)')
      return
    }

    setSubmitting(true)

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setError('Session expired. Please sign in again.')
      setSubmitting(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ role, phone })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    if (role === 'worker') {
      await supabase.from('worker_profiles').upsert({ user_id: user.id })
    } else if (role === 'customer') {
      await supabase.from('customer_profiles').upsert({ user_id: user.id })
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('pending_role')
      window.sessionStorage.removeItem('pending_phone')
    }

    redirectByRole(role)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page-bg mesh-gradient px-4">
        <p className="text-muted animate-pulse">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg mesh-gradient px-4">
      <div className="w-full max-w-md p-8 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 relative animate-fade-in-up">
        <h1 className="text-3xl font-extrabold text-center mb-2 text-gradient">Rozgar AI</h1>
        <h2 className="text-lg text-center text-muted mb-6">Complete Your Profile</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-body mb-1">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +923001234567"
              required
              className="w-full px-3 py-2 border border-line-strong rounded focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-body mb-2">I am a</label>
            <div className="flex gap-4">
              <label
                className={`flex-1 flex items-center justify-center p-3 border rounded-xl cursor-pointer transition hover-lift ${
                  role === 'worker'
                    ? 'border-primary bg-navy-50 text-primary'
                    : 'border-line-strong hover:border-accent'
                }`}
              >
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
              <label
                className={`flex-1 flex items-center justify-center p-3 border rounded-xl cursor-pointer transition hover-lift ${
                  role === 'customer'
                    ? 'border-primary bg-navy-50 text-primary'
                    : 'border-line-strong hover:border-accent'
                }`}
              >
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
            disabled={submitting}
            className="w-full py-2 px-4 btn-gradient rounded text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
