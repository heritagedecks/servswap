import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl">
                Welcome to ServSwap
              </h1>
              <p className="mx-auto max-w-[700px] text-lg md:text-xl">
                The platform where you swap services with others. No money needed - just trade skills and talents!
              </p>
            </div>
            <div className="space-x-4">
              <Link 
                href="/marketplace" 
                className="inline-flex h-10 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-indigo-600 shadow transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Explore Services
              </Link>
              <Link 
                href="/how-it-works" 
                className="inline-flex h-10 items-center justify-center rounded-md border border-white bg-transparent px-8 text-sm font-medium text-white shadow-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Learn More
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                How ServSwap Works
              </h2>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Exchange services with others in just a few simple steps.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3 lg:gap-12 mt-8">
            <div className="flex flex-col items-center space-y-2 rounded-lg border p-4">
              <div className="rounded-full bg-indigo-100 p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-indigo-600"
                >
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">1. Create Your Profile</h3>
              <p className="text-sm text-gray-500">
                Sign up and list the services you can offer to others.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2 rounded-lg border p-4">
              <div className="rounded-full bg-indigo-100 p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-indigo-600"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="m16 10-4 4-4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">2. Find Services</h3>
              <p className="text-sm text-gray-500">
                Browse the marketplace to find services you need.
              </p>
            </div>
            <div className="flex flex-col items-center space-y-2 rounded-lg border p-4">
              <div className="rounded-full bg-indigo-100 p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 text-indigo-600"
                >
                  <path d="M7.5 4.27 9 6l3-3" />
                  <path d="M11 12 9.5 13.5l-1-1 2-2-6-6-3 3 6 6" />
                  <path d="m16 16-3.5 3.5-1.5-1.5 3.5-3.5" />
                  <path d="M11.5 14.5 14 17l5-5-2.5-2.5-5 5z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold">3. Swap Services</h3>
              <p className="text-sm text-gray-500">
                Propose a swap with your services and get what you need in return.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gray-50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Popular Services
              </h2>
              <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Discover the most sought-after services on our platform.
              </p>
            </div>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-12 mt-8">
            {/* Service cards would be dynamically rendered here */}
            {["Graphic Design", "Web Development", "Photography", "Translation", "Tutoring", "Home Repairs"].map((service, index) => (
              <div key={index} className="flex flex-col items-start rounded-lg border bg-white p-4 shadow-sm">
                <div className="w-full h-40 bg-gray-200 rounded-md mb-4" />
                <h3 className="text-xl font-bold">{service}</h3>
                <p className="text-sm text-gray-500 mt-2">
                  Lorem ipsum dolor sit amet consectetur adipisicing elit.
                </p>
                <div className="mt-auto pt-4">
                  <Link 
                    href="/marketplace" 
                    className="inline-flex h-8 items-center justify-center rounded-md bg-indigo-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    Learn More
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-indigo-600 text-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center space-y-4 text-center">
            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Ready to Start Swapping?
              </h2>
              <p className="mx-auto max-w-[700px] text-lg md:text-xl">
                Join thousands of other users who are already exchanging services on ServSwap.
              </p>
            </div>
            <div>
              <Link 
                href="/auth/signup" 
                className="inline-flex h-10 items-center justify-center rounded-md bg-white px-8 text-sm font-medium text-indigo-600 shadow transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                Sign Up Now
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-6 bg-gray-900 text-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
            <div className="space-y-3">
              <h3 className="text-lg font-bold">ServSwap</h3>
              <ul className="space-y-1">
                <li>
                  <Link href="/about" className="hover:underline">About Us</Link>
                </li>
                <li>
                  <Link href="/team" className="hover:underline">Our Team</Link>
                </li>
                <li>
                  <Link href="/careers" className="hover:underline">Careers</Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold">Resources</h3>
              <ul className="space-y-1">
                <li>
                  <Link href="/guides" className="hover:underline">Guides</Link>
                </li>
                <li>
                  <Link href="/faq" className="hover:underline">FAQ</Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:underline">Contact Us</Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold">Legal</h3>
              <ul className="space-y-1">
                <li>
                  <Link href="/privacy" className="hover:underline">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:underline">Terms of Service</Link>
                </li>
                <li>
                  <Link href="/cookies" className="hover:underline">Cookie Policy</Link>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-bold">Connect</h3>
              <ul className="space-y-1">
                <li>
                  <Link href="https://twitter.com" className="hover:underline">Twitter</Link>
                </li>
                <li>
                  <Link href="https://facebook.com" className="hover:underline">Facebook</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-6 border-t border-gray-800 pt-6 text-center text-sm">
            <p>© {new Date().getFullYear()} ServSwap. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
} 