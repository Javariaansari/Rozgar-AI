import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

function AnimatedCounter({ value, suffix = '' }) {
  const [display, setDisplay] = useState(0)
  const ref = useRef(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true
            const target = typeof value === 'number' ? value : parseFloat(value) || 0
            const duration = 1200
            const start = performance.now()
            const tick = (now) => {
              const progress = Math.min((now - start) / duration, 1)
              const eased = 1 - Math.pow(1 - progress, 3)
              setDisplay(target * eased)
              if (progress < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
          }
        })
      },
      { threshold: 0.3 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [value])

  const formatted = Number.isInteger(value)
    ? Math.round(display).toLocaleString()
    : display.toFixed(1)

  return (
    <span ref={ref} className="animate-count">
      {formatted}
      {suffix}
    </span>
  )
}

export async function getServerSideProps(context) {
  const { createClient } = await import('@/lib/supabaseServer')
  const supabase = createClient(context.req, context.res)
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const destination =
      profile?.role === 'admin'
        ? '/admin'
        : profile?.role === 'customer'
        ? '/customer/dashboard'
        : '/worker/dashboard'

    return { redirect: { destination, permanent: false } }
  }

  const [verifiedWorkersRes, completedJobsRes, ratingsRes, testimonialsRes] =
    await Promise.all([
      supabase
        .from('worker_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('cnic_verified', true)
        .then((r) => r)
        .catch(() => ({ count: 0 })),
      supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .then((r) => r)
        .catch(() => ({ count: 0 })),
      supabase
        .from('ratings')
        .select('stars')
        .then((r) => r)
        .catch(() => ({ data: [] })),
      supabase
        .from('testimonials')
        .select('*')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })
        .limit(4)
        .then((r) => r)
        .catch(() => ({ data: [] })),
    ])

  const verifiedWorkers = verifiedWorkersRes.count || 0
  const completedJobs = completedJobsRes.count || 0
  const ratings = ratingsRes.data || []
  const testimonials = testimonialsRes.data || []

  const averageRating =
    ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r.stars, 0) / ratings.length).toFixed(1)
      : '0.0'

  return {
    props: {
      stats: {
        verifiedWorkers,
        completedJobs,
        averageRating: parseFloat(averageRating),
      },
      testimonials,
    },
  }
}

export default function Home({ stats, testimonials }) {
  const featureList = [
    {
      icon: '🎙️',
      title: 'Voice Onboarding',
      desc: 'Bol kar profile aur job posting banayein. Roman Urdu aur Urdu dono support hain.',
      gradient: 'from-navy-500 to-navy-700',
    },
    {
      icon: '🤖',
      title: 'AI Skill Assessment',
      desc: 'AI-verified skills aur trustworthy workers ki pehchaan.',
      gradient: 'from-accent to-navy-600',
    },
    {
      icon: '🛡️',
      title: 'Digital Skill Passport',
      desc: 'Worker ki verified profile, ratings, aur reviews sab ek jagah.',
      gradient: 'from-navy-700 to-primary',
    },
  ]

  const howItWorks = [
    {
      title: 'For Customers',
      color: 'text-primary',
      steps: [
        'Job post karein — text ya awaz ke zariye.',
        'AI aapke liye best workers match karega.',
        'Worker select karein aur kaam shuru karein.',
      ],
    },
    {
      title: 'For Workers',
      color: 'text-accent-dark',
      steps: [
        'Voice onboarding se profile banayein.',
        'Digital Skill Passport mein skills aur rating dikhein.',
        'Matching jobs apply karein aur kam hasil karein.',
      ],
    },
  ]

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <nav className="fixed top-0 inset-x-0 z-50 glass animate-fade-in-down">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gradient">
            Rozgar AI
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted">
            <a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a>
            <a href="#features" className="hover:text-primary transition-colors">Services</a>
            <a href="#about" className="hover:text-primary transition-colors">About Us</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-body hover:text-primary transition-colors"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-medium text-white rounded-md btn-gradient"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 hero-gradient-animated overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-[10%] w-24 h-24 rounded-full bg-white/10 animate-float" />
          <div className="absolute top-40 right-[15%] w-16 h-16 rounded-full bg-white/10 animate-float-delayed" />
          <div className="absolute bottom-20 left-[20%] w-32 h-32 rounded-full bg-white/5 animate-float-delayed" />
          <div className="absolute bottom-32 right-[10%] w-20 h-20 rounded-full bg-white/10 animate-float" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight animate-fade-in-up">
            Ghar Baithe Verified Workers
            <br />
            <span className="text-navy-100">Dhoondhein Ya Rozgar Hasil Karein</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-navy-100 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
            AI-powered matching aapko sahi worker ya sahi customer se jaldi aur bharosa mandi se milata hai.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <Link
              href="/signup?role=customer"
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-primary bg-white rounded-full shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all"
            >
              As a Customer Join Karein
            </Link>
            <Link
              href="/signup?role=worker"
              className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white border-2 border-white/40 rounded-full hover:bg-white/10 hover:-translate-y-1 transition-all backdrop-blur-sm"
            >
              As a Worker Join Karein
            </Link>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="mesh-gradient py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-heading animate-fade-in-up">
            How It Works
          </h2>
          <p className="mt-3 text-center text-muted max-w-xl mx-auto">
            Sirf 3 steps mein apna kaam ya rozgar secure karein.
          </p>
          <div className="mt-12 grid md:grid-cols-2 gap-8">
            {howItWorks.map((section, idx) => (
              <div
                key={section.title}
                className="card card-gradient hover-lift p-8 animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                <h3 className={`text-xl font-bold ${section.color}`}>{section.title}</h3>
                <ol className="mt-5 space-y-4 text-body">
                  {section.steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex-shrink-0 w-7 h-7 rounded-full bg-navy-100 text-navy-900 text-sm font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center text-heading animate-fade-in-up">
            Key Features
          </h2>
          <p className="mt-3 text-center text-muted max-w-xl mx-auto">
            Voice, AI, aur verified profiles — sab kuch ek platform par.
          </p>
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            {featureList.map((f, idx) => (
              <div
                key={f.title}
                className="group text-center p-8 rounded-2xl border border-line bg-white hover-lift animate-fade-in-up"
                style={{ animationDelay: `${idx * 0.15}s` }}
              >
                <div
                  className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${f.gradient} text-white flex items-center justify-center text-2xl shadow-lg icon-glow transition-transform duration-300 group-hover:scale-110`}
                >
                  {f.icon}
                </div>
                <h3 className="mt-5 text-xl font-bold text-heading">{f.title}</h3>
                <p className="mt-3 text-sm text-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="about" className="py-20 hero-gradient-animated relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-[5%] w-40 h-40 rounded-full bg-white/5 animate-float" />
          <div className="absolute bottom-10 right-[5%] w-28 h-28 rounded-full bg-white/5 animate-float-delayed" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white animate-fade-in-up">
            Trusted by Workers & Customers
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-10 md:gap-16">
            <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <p className="text-4xl md:text-5xl font-extrabold text-white">
                <AnimatedCounter value={stats.verifiedWorkers} suffix="+" />
              </p>
              <p className="mt-1 text-navy-100">Verified Workers</p>
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <p className="text-4xl md:text-5xl font-extrabold text-white">
                <AnimatedCounter value={stats.completedJobs} suffix="+" />
              </p>
              <p className="mt-1 text-navy-100">Completed Jobs</p>
            </div>
            <div className="animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <p className="text-4xl md:text-5xl font-extrabold text-white">
                <AnimatedCounter value={stats.averageRating} suffix="/5" />
              </p>
              <p className="mt-1 text-navy-100">Average Rating</p>
            </div>
          </div>

          <div className="mt-14 grid md:grid-cols-2 gap-6 text-left">
            {(testimonials.length > 0
              ? testimonials
              : [
                  {
                    id: 'default-1',
                    content:
                      'Rozgar AI ne mujhe Lahore mein acha electrician jaldi dila diya. AI matching kaam ki cheez hai.',
                    name: 'Ahmed',
                    role: 'customer',
                  },
                  {
                    id: 'default-2',
                    content:
                      'Meri voice se profile bani aur 3 din mein kaam mil gaya. Bahut asaan process hai.',
                    name: 'Rashid',
                    role: 'worker',
                  },
                ]
            ).map((t, idx) => (
              <div
                key={t.id}
                className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 hover:bg-white/20 hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${0.4 + idx * 0.15}s` }}
              >
                <p className="text-lg text-white italic leading-relaxed">"{t.content}"</p>
                <p className="mt-4 text-sm font-semibold text-navy-100">
                  — {t.name}, {t.role === 'worker' ? 'Worker' : 'Customer'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 bg-page-bg">
        <div className="max-w-4xl mx-auto px-4 text-center animate-fade-in-up">
          <h2 className="text-3xl font-bold text-heading">Abhi Rozgar AI Join Karein</h2>
          <p className="mt-3 text-muted">Free signup — customer ya worker, dono roles ke liye.</p>
          <div className="mt-8 flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/signup?role=customer"
              className="px-8 py-3.5 text-base font-semibold text-white rounded-full btn-gradient"
            >
              Customer Ke Tor Par Join Karein
            </Link>
            <Link
              href="/signup?role=worker"
              className="px-8 py-3.5 text-base font-semibold text-primary bg-white border-2 border-primary rounded-full hover:bg-navy-50 hover:-translate-y-1 transition-all"
            >
              Worker Ke Tor Par Join Karein
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-10 bg-white">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted">
          <p>© {new Date().getFullYear()} Rozgar AI. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/support" className="hover:text-primary transition-colors">Support</Link>
            <Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
