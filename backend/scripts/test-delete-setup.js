const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

const envText = fs.readFileSync('.env.local', 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
  if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
}

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

const WORKER_EMAIL = 'test-worker-delete@rozgar.ai'
const CUSTOMER_EMAIL = 'test-customer-delete@rozgar.ai'
const PASSWORD = 'Test@123456'

async function getUserByEmail(email) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (error) throw error
  return data.users.find((u) => u.email === email)
}

async function cleanup() {
  for (const email of [WORKER_EMAIL, CUSTOMER_EMAIL]) {
    const user = await getUserByEmail(email)
    if (user) {
      await supabaseAdmin.auth.admin.deleteUser(user.id)
      console.log('Deleted existing user:', email)
    }
  }
}

async function createUser(email, role, phone) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { role, phone },
  })
  if (error) throw error
  return data.user
}

async function main() {
  await cleanup()

  const worker = await createUser(WORKER_EMAIL, 'worker', '03001234567')
  const customer = await createUser(CUSTOMER_EMAIL, 'customer', '03009876543')

  console.log('Created worker:', worker.id)
  console.log('Created customer:', customer.id)

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .insert({
      customer_id: customer.id,
      title: 'Test Job for Delete Button',
      description: 'Temporary test job',
      category: 'general labor',
      budget: 5000,
      location: 'Lahore',
    })
    .select()
    .single()

  if (jobError) throw jobError
  console.log('Created job:', job.id)

  const { data: application, error: appError } = await supabaseAdmin
    .from('applications')
    .insert({ job_id: job.id, worker_id: worker.id })
    .select()
    .single()

  if (appError) throw appError
  console.log('Created application:', application.id)

  console.log('\nTest credentials:')
  console.log('Worker email:', WORKER_EMAIL)
  console.log('Password:', PASSWORD)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
