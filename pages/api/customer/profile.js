import { createClient } from '@/lib/supabaseServer'

const phoneRegex = /^(\+92|0|92)\d{10}$/

function isValidPhone(phone) {
  return typeof phone === 'string' && phoneRegex.test(phone.trim())
}

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const supabase = createClient(req, res)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return res.status(401).json({ message: 'Not authenticated' })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'customer') {
    return res.status(403).json({ message: 'Customer profile required' })
  }

  const { name, phone, company_name, address } = req.body

  if (!isValidPhone(phone)) {
    return res.status(400).json({ message: 'A valid phone number is required (e.g. +923001234567)' })
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ name: name?.trim() || null, phone: phone.trim() })
    .eq('id', user.id)

  if (profileError) {
    return res.status(500).json({ message: profileError.message })
  }

  const { error: customerError } = await supabase
    .from('customer_profiles')
    .update({
      company_name: company_name?.trim() || null,
      address: address?.trim() || null,
    })
    .eq('user_id', user.id)

  if (customerError) {
    return res.status(500).json({ message: customerError.message })
  }

  res.status(200).json({ message: 'Profile updated' })
}
