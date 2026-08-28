import { createClient } from '@/lib/supabaseServer'
import formidable from 'formidable'
import fs from 'fs'

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const supabase = createClient(req, res)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return res.status(401).json({ message: 'Not authenticated' })

  const form = formidable({ maxFileSize: 5 * 1024 * 1024 })
  const [fields, files] = await form.parse(req)

  const type = fields.type?.[0]
  if (!['profile_pic', 'cnic'].includes(type)) {
    return res.status(400).json({ message: 'type must be "profile_pic" or "cnic"' })
  }

  const file = files.file?.[0]
  if (!file) return res.status(400).json({ message: 'No file uploaded' })

  const fileBuffer = fs.readFileSync(file.filepath)
  const ext = file.originalFilename.split('.').pop()
  const bucket = 'worker-documents'
  const filePath = `${user.id}/${type}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileBuffer, {
      contentType: file.mimetype,
      upsert: false,
    })

  if (uploadError) {
    return res.status(500).json({ message: uploadError.message })
  }

  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(filePath)

  if (type === 'profile_pic') {
    await supabase.from('worker_profiles').update({ profile_pic_url: publicUrl }).eq('user_id', user.id)
  }

  fs.unlinkSync(file.filepath)

  res.status(200).json({ url: publicUrl, message: 'File uploaded' })
}
