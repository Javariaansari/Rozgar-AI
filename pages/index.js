import Link from 'next/link'

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

  return { props: {} }
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-blue-700">
            Rozgar AI
          </Link>
          <div className="hidden md:flex items-center gap-6 text-sm text-gray-600">
            <a href="#how-it-works" className="hover:text-gray-900">How It Works</a>
            <a href="#features" className="hover:text-gray-900">Services</a>
            <a href="#about" className="hover:text-gray-900">About Us</a>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </nav>

      <section className="max-w-6xl mx-auto px-4 py-16 md:py-24 text-center">
        <h1 className="text-3xl md:text-5xl font-extrabold text-gray-900 leading-tight">
          Ghar Baithe Verified Workers Dhoondhein Ya Rozgar Hasil Karein
        </h1>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
          AI-powered matching aapko sahi worker ya sahi customer se jaldi aur bharosa mandi se milata hai.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup?role=customer"
            className="w-full sm:w-auto px-6 py-3 text-base font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
          >
            As a Customer Join Karein
          </Link>
          <Link
            href="/signup?role=worker"
            className="w-full sm:w-auto px-6 py-3 text-base font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
          >
            As a Worker Join Karein
          </Link>
        </div>
      </section>

      <section id="how-it-works" className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900">How It Works</h2>
          <div className="mt-10 grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-blue-700">For Customers</h3>
              <ol className="mt-4 space-y-3 text-gray-700 text-sm list-decimal list-inside">
                <li>Job post karein — text ya awaz ke zariye.</li>
                <li>AI aapke liye best workers match karega.</li>
                <li>Worker select karein aur kaam shuru karein.</li>
              </ol>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-green-700">For Workers</h3>
              <ol className="mt-4 space-y-3 text-gray-700 text-sm list-decimal list-inside">
                <li>Voice onboarding se profile banayein.</li>
                <li>Digital Skill Passport mein skills aur rating dikhein.</li>
                <li>Matching jobs apply karein aur kam hasil karein.</li>
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-16">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900">Key Features</h2>
          <div className="mt-10 grid md:grid-cols-3 gap-6">
            <div className="border border-gray-200 rounded-lg p-6 text-center">
              <div className="w-12 h-12 mx-auto bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xl font-bold">
                MIC
              </div>
              <h3 className="mt-4 font-bold text-gray-900">Voice Onboarding</h3>
              <p className="mt-2 text-sm text-gray-600">
                Bol kar profile aur job posting banayein. Roman Urdu aur Urdu dono support hain.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 text-center">
              <div className="w-12 h-12 mx-auto bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xl font-bold">
                AI
              </div>
              <h3 className="mt-4 font-bold text-gray-900">AI Skill Assessment</h3>
              <p className="mt-2 text-sm text-gray-600">
                AI-verified skills aur trustworthy workers ki pehchaan.
              </p>
            </div>
            <div className="border border-gray-200 rounded-lg p-6 text-center">
              <div className="w-12 h-12 mx-auto bg-yellow-100 text-yellow-700 rounded-full flex items-center justify-center text-xl font-bold">
                ID
              </div>
              <h3 className="mt-4 font-bold text-gray-900">Digital Skill Passport</h3>
              <p className="mt-2 text-sm text-gray-600">
                Worker ki verified profile, ratings, aur reviews sab ek jagah.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="bg-gray-50 py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Trusted by Workers & Customers</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-8">
            <div>
              <p className="text-3xl font-bold text-blue-700">500+</p>
              <p className="text-sm text-gray-600">Verified Workers</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-700">1,200+</p>
              <p className="text-sm text-gray-600">Completed Jobs</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-blue-700">4.8/5</p>
              <p className="text-sm text-gray-600">Average Rating</p>
            </div>
          </div>
          <div className="mt-10 grid md:grid-cols-2 gap-6 text-left">
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-700">
                "Rozgar AI ne mujhe Lahore mein acha electrician jaldi dila diya. AI matching kaam ki cheez hai."
              </p>
              <p className="mt-3 text-sm font-medium text-gray-900">— Ahmed, Customer</p>
            </div>
            <div className="bg-white rounded-lg shadow p-5">
              <p className="text-sm text-gray-700">
                "Meri voice se profile bani aur 3 din mein kaam mil gaya. Bahut asaan process hai."
              </p>
              <p className="mt-3 text-sm font-medium text-gray-900">— Rashid, Electrician</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <p>© {new Date().getFullYear()} Rozgar AI. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/support" className="hover:text-gray-900">Support</Link>
            <Link href="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-900">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
