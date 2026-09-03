import { GoogleGenerativeAI } from '@google/generative-ai'

const apiKey = process.env.GEMINI_API_KEY
const useMock = process.env.MOCK_AI === 'true' || !apiKey || !apiKey.startsWith('AIzaSy')

let genAI = null
if (!useMock) {
  genAI = new GoogleGenerativeAI(apiKey)
}

function mockExtractProfile(text) {
  const lower = text.toLowerCase()
  const skills = []
  if (lower.includes('electrician') || lower.includes('wiring') || lower.includes('الیکٹریشن')) skills.push('electrician')
  if (lower.includes('plumber') || lower.includes('pipe') || lower.includes('پلمبر')) skills.push('plumber')
  if (lower.includes('carpenter') || lower.includes('wood') || lower.includes('کارپینٹر')) skills.push('carpenter')
  if (lower.includes('painter') || lower.includes('paint') || lower.includes('پینٹر')) skills.push('painter')
  if (lower.includes('driver') || lower.includes('ڈرائیور')) skills.push('driver')
  if (skills.length === 0) skills.push('general labor')

  const experienceYears = /\b(\d+)\s*(?:saal|سال|years|year|sal)\b/i.test(text)
    ? Number(text.match(/\b(\d+)\s*(?:saal|سال|years|year|sal)\b/i)[1])
    : null

  const location = lower.includes('lahore') || lower.includes('لاہور')
    ? 'Lahore'
    : lower.includes('karachi') || lower.includes('کراچی')
    ? 'Karachi'
    : lower.includes('islamabad') || lower.includes('اسلام آباد')
    ? 'Islamabad'
    : null

  const bio = `Experienced ${skills.join(', ')} with ${experienceYears || 'several'} years of hands-on experience.${location ? ` Based in ${location}.` : ''}`

  return {
    name: null,
    skills,
    experience_years: experienceYears,
    bio,
    location,
  }
}

function mockQuestions(skills) {
  const skill = skills[0] || 'general labor'
  return {
    questions: [
      { skill, question: `Aap ${skill} mein apna 1 saal ka tajurba batain?` },
      { skill, question: `${skill} ka kaam shuru karte waqt sab se pehle kya check karte hain?` },
      { skill, question: `Agar koi customer aap se ${skill} ka kaam karwata hai toh aap kis tarah trust banate hain?` },
    ],
  }
}

function mockScores(questions) {
  const scores = {}
  questions.forEach(q => {
    scores[q.skill] = Math.floor(60 + Math.random() * 35)
  })
  return {
    scores,
    feedback: 'Aapke answers achay hain. Mazeed tajurba aur confidence se kaam karen.',
  }
}

function mockExtractJob(text) {
  const lower = text.toLowerCase()

  const titleMatch = text.match(/(?:job|kaam|کام)\s+(?:hai|ہے|is)\s+(?:for\s+)?([^,.]+)/i)
    || text.match(/(?:chahiye|چاہیے|needed|required)\s+([^,.]+)/i)
  const title = titleMatch ? titleMatch[1].trim() : lower.includes('electrician') ? 'Electrician needed' : 'Labor required'

  const category = lower.includes('electrician') || lower.includes('الیکٹریشن')
    ? 'electrician'
    : lower.includes('plumber') || lower.includes('پلمبر')
    ? 'plumber'
    : lower.includes('carpenter') || lower.includes('کارپینٹر')
    ? 'carpenter'
    : lower.includes('painter') || lower.includes('پینٹر')
    ? 'painter'
    : lower.includes('driver') || lower.includes('ڈرائیور')
    ? 'driver'
    : 'general labor'

  const budgetMatch = text.match(/(?:budget|max|tak|تک)\s*(?:is\s*)?(?:rs\.?|pkr|rupees)?\s*(\d+)/i)
    || text.match(/(\d+)\s*(?:rs\.?|pkr|rupees)/i)
  const budget = budgetMatch ? Number(budgetMatch[1]) : null

  const location = lower.includes('lahore') || lower.includes('لاہور')
    ? 'Lahore'
    : lower.includes('karachi') || lower.includes('کراچی')
    ? 'Karachi'
    : lower.includes('islamabad') || lower.includes('اسلام آباد')
    ? 'Islamabad'
    : null

  return {
    title,
    category,
    description: text,
    budget,
    location,
  }
}

function mockMatchJobs(workerProfile, jobs) {
  const workerSkills = workerProfile?.skills?.map(s => s.toLowerCase()) || []
  return jobs.map(job => {
    const jobText = `${job.title} ${job.description || ''} ${job.category || ''}`.toLowerCase()
    const matchedSkills = workerSkills.filter(skill => jobText.includes(skill))
    const score = matchedSkills.length > 0
      ? Math.min(95, 50 + matchedSkills.length * 20)
      : Math.floor(20 + Math.random() * 30)
    return {
      job_id: job.id,
      match_score: score,
      reasoning: matchedSkills.length > 0
        ? `Aapke skills (${matchedSkills.join(', ')}) is job se match karte hain.`
        : 'Yeh job aapke skills ke qareeb hai, mazeed detail dekh sakte hain.',
    }
  })
}

export async function extractJobFromVoice(transcribedText) {
  if (useMock) {
    console.log('[MOCK AI] extractJobFromVoice')
    return mockExtractJob(transcribedText)
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const prompt = `Extract structured job posting data from the following spoken text. The text may be in English, Roman Urdu, Urdu (Arabic script), Urdu-English mix, or Hindi-English mix.

Return ONLY valid JSON with these fields, all values translated into English:
{
  "title": "short job title in English",
  "category": "job category like electrician, plumber, driver, general labor",
  "description": "full job description in English",
  "budget": number or null,
  "location": "city/area in English or null"
}

If the input is in Urdu or Roman Urdu, translate title, category, description, and location into English. If a field is not mentioned, set it to null. Do not add any explanation, just return the JSON.

Spoken text: "${transcribedText}"`

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(text)
  } catch (err) {
    console.warn('[Gemini] fallback to mock:', err.message)
    return mockExtractJob(transcribedText)
  }
}

export async function extractProfileFromVoice(transcribedText) {
  if (useMock) {
    console.log('[MOCK AI] extractProfileFromVoice')
    return mockExtractProfile(transcribedText)
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const prompt = `Extract structured worker profile data from the following spoken text. The text may be in English, Roman Urdu, Urdu (Arabic script), Urdu-English mix, or Hindi-English mix.

Return ONLY valid JSON with these fields, all values translated into English:
{
  "name": "full name in English or null",
  "skills": ["skill1", "skill2"],
  "experience_years": number or null,
  "bio": "short professional summary in English",
  "location": "city/area in English or null"
}

If the input is in Urdu or Roman Urdu, translate skills, bio, and location into English. Keep names in English script when possible. If a field is not mentioned, set it to null (or empty array for skills). Do not add any explanation, just return the JSON.

Spoken text: "${transcribedText}"`

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(text)
  } catch (err) {
    console.warn('[Gemini] fallback to mock:', err.message)
    return mockExtractProfile(transcribedText)
  }
}

export async function generateAssessmentQuestions(skills, bio) {
  if (useMock) {
    console.log('[MOCK AI] generateAssessmentQuestions')
    return mockQuestions(skills)
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const prompt = `You are assessing a blue-collar worker's skills. Their skills are: ${skills.join(', ') || 'general labor'}.
${bio ? `About them: ${bio}` : ''}

Generate 3 practical interview questions to test their abilities. The questions should be in simple English or Roman Urdu (whichever is easier for a Pakistani worker). Return ONLY valid JSON in this exact format:
{
  "questions": [
    { "skill": "skill name", "question": "question text" }
  ]
}

Do not add any explanation, just return the JSON.`

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(text)
  } catch (err) {
    console.warn('[Gemini] fallback to mock:', err.message)
    return mockQuestions(skills)
  }
}

export async function evaluateAssessmentAnswers(questions, answers) {
  if (useMock) {
    console.log('[MOCK AI] evaluateAssessmentAnswers')
    return mockScores(questions)
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const qaPairs = questions.map((q, i) => ({
      skill: q.skill,
      question: q.question,
      answer: answers[i] || '',
    }))

    const prompt = `Evaluate the following worker's answers to skill assessment questions. Give a score from 0 to 100 for each skill based on the answer quality. Return ONLY valid JSON in this exact format:
{
  "scores": {
    "skill name": 85,
    "another skill": 60
  },
  "feedback": "short overall feedback in English or Roman Urdu"
}

Assessment data: ${JSON.stringify(qaPairs)}

Do not add any explanation, just return the JSON.`

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
    return JSON.parse(text)
  } catch (err) {
    console.warn('[Gemini] fallback to mock:', err.message)
    return mockScores(questions)
  }
}

export async function matchJobs(workerProfile, jobs) {
  if (useMock) {
    console.log('[MOCK AI] matchJobs')
    return mockMatchJobs(workerProfile, jobs)
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' })
    const prompt = `You are matching a worker to available jobs. Return ONLY valid JSON with an array of matches.

Worker Profile:
- Skills: ${workerProfile?.skills?.join(', ') || 'general labor'}
- Bio: ${workerProfile?.bio || 'Not provided'}

Available Jobs:
${JSON.stringify(jobs.map(j => ({ id: j.id, title: j.title, description: j.description, category: j.category, location: j.location, budget: j.budget })))}

Return JSON in this exact format:
{
  "matches": [
    { "job_id": "uuid", "match_score": 85, "reasoning": "short reason in English or Roman Urdu" }
  ]
}

Score 0-100 based on skill relevance, location match, and experience. Do not add explanation, just return JSON.`

    const result = await model.generateContent(prompt)
    const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()
    const parsed = JSON.parse(text)
    return parsed.matches || []
  } catch (err) {
    console.warn('[Gemini] fallback to mock:', err.message)
    return mockMatchJobs(workerProfile, jobs)
  }
}
