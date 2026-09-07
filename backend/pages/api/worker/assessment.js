import { createClient } from '@/lib/supabaseServer'
import { generateAssessmentQuestions, evaluateAssessmentAnswers } from '@/lib/gemini'

export default async function handler(req, res) {
  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'worker') {
    return res.status(403).json({ message: 'Worker profile required' })
  }

  const { data: workerProfile } = await supabase
    .from('worker_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (req.method === 'GET') {
    return res.status(200).json({ profile, workerProfile })
  }

  if (req.method === 'POST') {
    const skills = workerProfile?.skills?.length > 0 ? workerProfile.skills : ['general labor']
    const bio = workerProfile?.bio || ''

    try {
      const { questions } = await generateAssessmentQuestions(skills, bio)
      return res.status(200).json({ questions })
    } catch (err) {
      console.error('Generate assessment error:', err)
      return res.status(500).json({ message: 'Failed to generate questions' })
    }
  }

  if (req.method === 'PUT') {
    const { questions, answers } = req.body
    if (!questions || !answers || questions.length !== answers.length) {
      return res.status(400).json({ message: 'Questions and answers required' })
    }

    try {
      const { scores, feedback } = await evaluateAssessmentAnswers(questions, answers)

      const { error } = await supabase
        .from('worker_profiles')
        .update({ ai_skill_score: scores })
        .eq('user_id', user.id)

      if (error) {
        return res.status(500).json({ message: error.message })
      }

      return res.status(200).json({ scores, feedback })
    } catch (err) {
      console.error('Evaluate assessment error:', err)
      return res.status(500).json({ message: 'Failed to evaluate answers' })
    }
  }

  res.status(405).json({ message: 'Method not allowed' })
}
