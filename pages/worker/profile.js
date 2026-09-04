import { useState, useRef } from 'react'
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

export default function WorkerProfile({ profile: initialProfile, workerProfile: initialWorker }) {
  const [profile, setProfile] = useState(initialProfile)
  const [workerProfile, setWorkerProfile] = useState(initialWorker)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    name: initialProfile?.name || '',
    phone: initialProfile?.phone || '',
    bio: initialWorker?.bio || '',
    skills: initialWorker?.skills?.join(', ') || '',
    experience_years: initialWorker?.experience_years || '',
    location: initialWorker?.location || '',
  })
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const picInputRef = useRef(null)
  const cnicInputRef = useRef(null)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSave() {
    setError('')
    setSuccess('')

    const res = await fetch('/api/worker/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        phone: form.phone,
        bio: form.bio,
        skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
        experience_years: form.experience_years,
        location: form.location,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.message || 'Failed to save')
      return
    }

    setProfile(p => ({ ...p, name: form.name, phone: form.phone }))
    setWorkerProfile(w => ({
      ...w,
      bio: form.bio,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      experience_years: form.experience_years ? Number(form.experience_years) : null,
      location: form.location,
    }))
    setEditing(false)
    setSuccess('Profile updated')
    setTimeout(() => setSuccess(''), 3000)
  }

  async function handleUpload(e, type) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const res = await fetch('/api/worker/upload', {
      method: 'POST',
      body: formData,
    })

    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setError(data.message || 'Upload failed')
      return
    }

    if (type === 'profile_pic') {
      setWorkerProfile(w => ({ ...w, profile_pic_url: data.url }))
    } else if (type === 'cnic') {
      setWorkerProfile(w => ({ ...w, cnic_url: data.url, cnic_verified: false, cnic_verified_at: null, cnic_verified_by: null }))
    }

    setSuccess(`${type === 'profile_pic' ? 'Profile photo' : 'CNIC'} uploaded`)
    setTimeout(() => setSuccess(''), 3000)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold">Rozgar AI</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/worker/dashboard')}
              className="text-sm text-blue-600 hover:underline"
            >
              Dashboard
            </button>
            <button onClick={handleLogout} className="text-sm text-gray-600 hover:text-gray-900">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{success}</div>}

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Digital Skill Passport</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => router.push('/worker/jobs')}
                className="px-4 py-1.5 rounded text-sm font-medium bg-green-100 text-green-700 hover:bg-green-200"
              >
                Find Jobs
              </button>
              <button
                onClick={() => router.push('/worker/assessment')}
                className="px-4 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-700 hover:bg-blue-200"
              >
                AI Assessment
              </button>
              <button
                onClick={() => editing ? handleSave() : setEditing(true)}
                disabled={uploading}
                className={`px-4 py-1.5 rounded text-sm font-medium ${
                  editing
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
              >
                {editing ? 'Save' : 'Edit'}
              </button>
            </div>
          </div>

          {editing ? (
            <div className="space-y-4">
              <div className="flex items-start gap-6 mb-6">
                <div className="flex-shrink-0 text-center">
                  <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                    {workerProfile?.profile_pic_url ? (
                      <img src={workerProfile.profile_pic_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-3xl text-gray-400">?</span>
                    )}
                  </div>
                  <input ref={picInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'profile_pic')} />
                  <button
                    onClick={() => picInputRef.current?.click()}
                    disabled={uploading}
                    className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Change photo'}
                  </button>
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Experience (years)</label>
                  <input
                    type="number"
                    value={form.experience_years}
                    onChange={(e) => setForm(f => ({ ...f, experience_years: e.target.value }))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Karachi"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Skills</label>
                <input
                  value={form.skills}
                  onChange={(e) => setForm(f => ({ ...f, skills: e.target.value }))}
                  placeholder="electrician, plumber, painter (comma-separated)"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Professional Summary</label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-8 text-white">
                <div className="flex items-start gap-5">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-white/20 overflow-hidden flex items-center justify-center border-2 border-white/40">
                      {workerProfile?.profile_pic_url ? (
                        <img src={workerProfile.profile_pic_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">👤</span>
                      )}
                    </div>
                    <input ref={picInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, 'profile_pic')} />
                    <button
                      onClick={() => picInputRef.current?.click()}
                      disabled={uploading}
                      className="mt-2 text-xs text-blue-100 hover:text-white hover:underline disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : 'Change photo'}
                    </button>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold">{profile?.name || 'No name set'}</h3>
                    <p className="text-blue-100 mt-1">{workerProfile?.skills?.slice(0, 3).join(' • ') || 'General Labor'}</p>
                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-blue-50">
                      {profile?.phone && <span>📞 {profile.phone}</span>}
                      {profile?.email && <span>✉️ {profile.email}</span>}
                      {workerProfile?.location ? <span>📍 {workerProfile.location}</span> : null}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <section>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">Professional Summary</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">{workerProfile?.bio || profile?.bio || 'No professional summary added yet.'}</p>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {workerProfile?.skills?.length > 0 ? workerProfile.skills.map((skill, i) => (
                      <span key={i} className="bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm font-medium border border-blue-100">{skill}</span>
                    )) : (
                      <span className="text-sm text-gray-400">No skills added yet</span>
                    )}
                  </div>
                </section>

                <section>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">Experience</h4>
                  <div className="text-sm text-gray-700">
                    {workerProfile?.experience_years ? (
                      <>
                        <p className="font-medium">{workerProfile.experience_years} years</p>
                        <p className="text-gray-600 mt-1">Hands-on experience in {workerProfile.skills?.join(', ') || 'the listed skills'}.</p>
                      </>
                    ) : (
                      <p className="text-gray-500">Experience not specified. Edit profile to add years of experience.</p>
                    )}
                  </div>
                </section>

                {workerProfile?.voice_transcript && (
                  <section>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">Voice Resume</h4>
                    <div className="bg-gray-50 border border-gray-200 rounded p-4">
                      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap" dir="auto">{workerProfile.voice_transcript}</p>
                    </div>
                  </section>
                )}

                {workerProfile?.ai_skill_score && Object.keys(workerProfile.ai_skill_score).length > 0 && (
                  <section>
                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">AI Skill Score</h4>
                    <div className="space-y-3">
                      {Object.entries(workerProfile.ai_skill_score).map(([skill, score]) => (
                        <div key={skill} className="flex items-center gap-3 text-sm">
                          <span className="text-gray-700 w-28 font-medium">{skill}</span>
                          <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${score}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-gray-600 w-10 text-right">{score}%</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide border-b border-gray-200 pb-2 mb-3">Trust & Verification</h4>
                  <div className="flex flex-wrap items-center gap-3">
                    {workerProfile?.cnic_verified ? (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-green-100 text-green-800">
                        ✅ CNIC Verified
                      </span>
                    ) : workerProfile?.cnic_url ? (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-yellow-100 text-yellow-800">
                        ⏳ Awaiting admin verification
                      </span>
                    ) : (
                      <span className="text-xs px-3 py-1 rounded-full font-medium bg-gray-100 text-gray-800">
                        ⏳ CNIC Not Verified
                      </span>
                    )}
                    {workerProfile?.cnic_url && (
                      <a
                        href={workerProfile.cnic_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline"
                      >
                        View uploaded CNIC
                      </a>
                    )}
                    <input ref={cnicInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleUpload(e, 'cnic')} />
                    <button
                      onClick={() => cnicInputRef.current?.click()}
                      disabled={uploading}
                      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {uploading ? 'Uploading...' : (workerProfile?.cnic_url ? 'Re-upload CNIC' : 'Upload CNIC')}
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
