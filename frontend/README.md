# Rozgar AI

MVP job marketplace for blue-collar workers and customers in Pakistan. Workers build a voice-powered Digital Skill Passport, customers post jobs by voice or form, and AI matches the best worker for each job.

## Stack

- Next.js Pages Router
- Tailwind CSS
- Supabase Auth + PostgreSQL + Storage
- Gemini AI (optional mock mode)

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.local.example` to `.env.local` and fill in real values:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-key
MOCK_AI=true
```

`SUPABASE_SERVICE_ROLE_KEY` is required for admin panel mutations (ban/delete users, manage disputes).

3. Run migrations in Supabase SQL Editor in this order:

- `supabase/schema.sql` (or the numbered migration files in `supabase/migrations/`)
- `supabase/migrations/20260903_add_ratings_to_resume.sql`
- `supabase/migrations/20260910_admin_panel.sql`

4. Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Creating the first admin

Admins cannot self-register. To promote an existing account:

1. Sign up as a worker or customer with the email you want to use as admin.
2. Open `supabase/seed_admin.sql`, replace `admin@rozgar.ai` with that email.
3. Run the SQL in the Supabase SQL Editor.
4. Sign out and sign back in — you will be redirected to `/admin`.

## Key pages

- `/login`, `/signup` — auth
- `/worker/dashboard` — worker home + voice resume + applications + disputes
- `/worker/profile` — Digital Skill Passport + CNIC upload
- `/worker/jobs` — AI job matches
- `/customer/dashboard` — posted jobs + applicants + disputes
- `/customer/post-job` — post a job
- `/admin` — admin panel (users, jobs, disputes, stats)

## Build

```bash
npm run build
```
