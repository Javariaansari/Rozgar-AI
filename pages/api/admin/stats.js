import { requireAdminApi, logAdminAction } from '@/lib/requireAdmin'

function enrichRatings(ratings, profilesMap, jobsMap) {
  return ratings.map((r) => ({
    ...r,
    from_name: profilesMap[r.from_user_id]?.name || profilesMap[r.from_user_id]?.email || 'Unknown',
    to_name: profilesMap[r.to_user_id]?.name || profilesMap[r.to_user_id]?.email || 'Unknown',
    job_title: jobsMap[r.job_id]?.title || 'Unknown job',
  }))
}

export default async function handler(req, res) {
  const guard = await requireAdminApi(req, res)
  if (!guard) return
  const { admin, user } = guard

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  try {
    const [{ data: users }, { data: workers }, { data: jobs }, { data: disputes }, { data: recentRatings }] = await Promise.all([
      admin.from('profiles').select('role, is_banned'),
      admin.from('worker_profiles').select('cnic_verified'),
      admin.from('jobs').select('status, is_flagged'),
      admin.from('disputes').select('status'),
      admin
        .from('ratings')
        .select('id, job_id, from_user_id, to_user_id, stars, review_text, created_at')
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    const userCounts = { total: 0, worker: 0, customer: 0, admin: 0, banned: 0 }
    ;(users || []).forEach((u) => {
      userCounts.total++
      if (userCounts[u.role] !== undefined) userCounts[u.role]++
      if (u.is_banned) userCounts.banned++
    })

    const workerCounts = { cnic_verified: 0, cnic_pending: 0 }
    ;(workers || []).forEach((w) => {
      if (w.cnic_verified) workerCounts.cnic_verified++
      else workerCounts.cnic_pending++
    })

    const jobCounts = { total: 0, open: 0, in_progress: 0, completed: 0, cancelled: 0, flagged: 0 }
    ;(jobs || []).forEach((j) => {
      jobCounts.total++
      if (jobCounts[j.status] !== undefined) jobCounts[j.status]++
      if (j.is_flagged) jobCounts.flagged++
    })

    const disputeCounts = { total: 0, open: 0, under_review: 0, resolved: 0, rejected: 0 }
    ;(disputes || []).forEach((d) => {
      disputeCounts.total++
      if (disputeCounts[d.status] !== undefined) disputeCounts[d.status]++
    })

    let enrichedRatings = []
    if (recentRatings && recentRatings.length > 0) {
      const profileIds = new Set()
      const jobIds = new Set()
      recentRatings.forEach((r) => {
        profileIds.add(r.from_user_id)
        profileIds.add(r.to_user_id)
        jobIds.add(r.job_id)
      })

      const [{ data: profiles }, { data: jobsData }] = await Promise.all([
        admin.from('profiles').select('id, name, email').in('id', Array.from(profileIds)),
        admin.from('jobs').select('id, title').in('id', Array.from(jobIds)),
      ])

      const profilesMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
      const jobsMap = Object.fromEntries((jobsData || []).map((j) => [j.id, j]))
      enrichedRatings = enrichRatings(recentRatings, profilesMap, jobsMap)
    }

    const { data: recentDisputes } = await admin
      .from('disputes')
      .select('id, status, reason, created_at, job:jobs!disputes_job_id_fkey(id, title), raiser:profiles!disputes_raised_by_fkey(id, name, email)')
      .order('created_at', { ascending: false })
      .limit(5)

    await logAdminAction(admin, user.id, 'stats.view', null, null, {})

    res.status(200).json({
      users: userCounts,
      workers: workerCounts,
      jobs: jobCounts,
      disputes: disputeCounts,
      recent_ratings: enrichedRatings,
      recent_disputes: recentDisputes || [],
    })
  } catch (err) {
    res.status(500).json({ message: err.message })
  }
}
