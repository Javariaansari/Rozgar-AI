import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export async function extractProfileFromVoice(transcribedText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' })

  const prompt = `Extract structured worker profile data from the following spoken text. The text may be in English, Roman Urdu, Urdu-English mix, or Hindi-English mix. Return ONLY valid JSON with these fields:
{
  "name": "full name or null",
  "skills": ["skill1", "skill2"],
  "experience_years": number or null,
  "bio": "short summary in the same language as the input",
  "location": "city/area mentioned or null"
}

If a field is not mentioned, set it to null (or empty array for skills). Do not add any explanation, just return the JSON.

Spoken text: "${transcribedText}"`

  const result = await model.generateContent(prompt)
  const text = result.response.text().replace(/```json\n?|\n?```/g, '').trim()

  return JSON.parse(text)
}
