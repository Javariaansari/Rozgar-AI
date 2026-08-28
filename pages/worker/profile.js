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
    }

    setSuccess(`${type === 'profile_pic' ? 'Profile photo' : 'CNIC'} uploaded`)
    setTimeout(() => setSuccess(''), 3000)
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
        {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{success}</div>}

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Digital Skill Passport</h2>
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

          <div className="flex items-start gap-6 mb-6">
            <div className="flex-shrink-0">
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
                className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50 block w-full text-center"
              >
                {uploading ? 'Uploading...' : 'Change photo'}
              </button>
            </div>

            <div className="flex-1 space-y-3">
              {editing ? (
                <>
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
                </>
              ) : (
                <>
                  <p className="text-lg font-medium">{profile?.name || 'No name set'}</p>
                  <p className="text-sm text-gray-500">{profile?.phone || 'No phone set'}</p>
                  <p className="text-sm text-gray-500">{profile?.email}</p>
                </>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Skills</label>
              {editing ? (
                <input
                  value={form.skills}
                  onChange={(e) => setForm(f => ({ ...f, skills: e.target.value }))}
                  placeholder="electrician, plumber, painter (comma-separated)"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <div className="flex flex-wrap gap-1">
                  {workerProfile?.skills?.length > 0 ? workerProfile.skills.map((skill, i) => (
                    <span key={i} className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{skill}</span>
                  )) : (
                    <span className="text-sm text-gray-400">No skills added yet</span>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bio</label>
              {editing ? (
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm(f => ({ ...f, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-sm text-gray-700">{workerProfile?.bio || 'No bio set'}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">CNIC / ID Document</label>
              <input ref={cnicInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => handleUpload(e, 'cnic')} />
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded ${
                  workerProfile?.cnic_verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {workerProfile?.cnic_verified ? 'Verified' : 'Not verified'}
                </span>
                <button
                  onClick={() => cnicInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload CNIC'}
                </button>
              </div>
            </div>

            {workerProfile?.ai_skill_score && Object.keys(workerProfile.ai_skill_score).length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">AI Skill Score</label>
                <div className="space-y-1">
                  {Object.entries(workerProfile.ai_skill_score).map(([skill, score]) => (
                    <div key={skill} className="flex items-center gap-2 text-sm">
                      <span className="text-gray-700 w-24">{skill}</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${score}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
