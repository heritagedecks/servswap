export default function HowItWorksPage() {
  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-8">How ServSwap Works</h1>
          
          <div className="prose prose-lg max-w-none">
            <h2>Trading Services Instead of Money</h2>
            <p>
              ServSwap is a platform that lets you exchange skills and services with others without exchanging money. 
              It's based on the age-old concept of bartering, but made modern and accessible through technology.
            </p>
            
            <h2 className="mt-8">The Process in 4 Simple Steps</h2>
            
            <div className="mt-6 space-y-10">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 bg-indigo-100 text-indigo-800 font-bold text-2xl h-12 w-12 rounded-full flex items-center justify-center">1</div>
                <div>
                  <h3 className="text-xl font-semibold">Create Your Account & List Your Services</h3>
                  <p className="mt-2">
                    Sign up for a free account and create a profile that highlights your skills. 
                    Add detailed descriptions of the services you're willing to offer to others.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 bg-indigo-100 text-indigo-800 font-bold text-2xl h-12 w-12 rounded-full flex items-center justify-center">2</div>
                <div>
                  <h3 className="text-xl font-semibold">Browse the Marketplace</h3>
                  <p className="mt-2">
                    Explore services offered by other members of the community. 
                    Find services that match your needs using our search and filtering tools.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 bg-indigo-100 text-indigo-800 font-bold text-2xl h-12 w-12 rounded-full flex items-center justify-center">3</div>
                <div>
                  <h3 className="text-xl font-semibold">Propose a Service Swap</h3>
                  <p className="mt-2">
                    When you find a service you want, propose a swap by offering one of your own services in return. 
                    The other person can accept, decline, or suggest modifications to your proposal.
                  </p>
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="flex-shrink-0 bg-indigo-100 text-indigo-800 font-bold text-2xl h-12 w-12 rounded-full flex items-center justify-center">4</div>
                <div>
                  <h3 className="text-xl font-semibold">Complete the Swap</h3>
                  <p className="mt-2">
                    Once both parties agree, you'll coordinate to deliver your services. 
                    After completion, you'll both confirm the swap is complete and leave feedback for each other.
                  </p>
                </div>
              </div>
            </div>
            
            <h2 className="mt-12">Service Value & Equity</h2>
            <p>
              ServSwap operates on the principle that all skills have value. While some services might traditionally 
              cost more than others in the market economy, we encourage users to find equitable exchanges that feel fair to both parties.
            </p>
            <p>
              For example, a web developer might swap 1 hour of coding for 2 hours of language tutoring, or a photographer might 
              exchange a photoshoot for help with home repairs.
            </p>
            
            <div className="bg-indigo-50 p-6 rounded-lg mt-10">
              <h2 className="text-xl font-semibold text-indigo-800 mb-4">Ready to Start Swapping?</h2>
              <p className="mb-4">Join our community today and start exchanging services!</p>
              <div className="flex flex-wrap gap-4">
                <a 
                  href="/auth/signup" 
                  className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
                >
                  Sign Up
                </a>
                <a 
                  href="/marketplace" 
                  className="px-6 py-2 border border-indigo-600 text-indigo-600 rounded-md hover:bg-indigo-50 transition-colors"
                >
                  Explore Marketplace
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
} 