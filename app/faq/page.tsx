'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface FAQItem {
  id: string;
  question: string;
  answer: React.ReactNode;
  category: 'general' | 'account' | 'services' | 'swaps' | 'billing';
}

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  const toggleItem = (id: string) => {
    setOpenItems(prevOpenItems => 
      prevOpenItems.includes(id)
        ? prevOpenItems.filter(item => item !== id)
        : [...prevOpenItems, id]
    );
  };
  
  const isOpen = (id: string) => openItems.includes(id);
  
  const faqItems: FAQItem[] = [
    // General Questions
    {
      id: 'what-is-servswap',
      question: 'What is ServSwap?',
      answer: (
        <>
          <p>ServSwap is a platform that allows users to exchange services with one another based on their skills and talents. Instead of paying for services with money, you can swap your expertise with others.</p>
          <p className="mt-2">For example, a graphic designer could swap their design services with a photographer who needs branding, and in return, receive professional photography.</p>
        </>
      ),
      category: 'general'
    },
    {
      id: 'how-does-servswap-work',
      question: 'How does ServSwap work?',
      answer: (
        <>
          <p>ServSwap works in a few simple steps:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Create an account and set up your profile</li>
            <li>List the services you can offer</li>
            <li>Browse the marketplace for services you need</li>
            <li>Contact service providers to propose a swap</li>
            <li>Negotiate and agree on the details of the exchange</li>
            <li>Complete the swap and leave endorsements for each other</li>
          </ol>
        </>
      ),
      category: 'general'
    },
    {
      id: 'is-servswap-free',
      question: 'Is ServSwap free to use?',
      answer: (
        <>
          <p>ServSwap operates on a subscription model. We offer the following plans:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li><strong>Basic Plan:</strong> $10/month or $96/year (20% savings with annual billing)</li>
            <li><strong>Verified Add-on:</strong> $5/month additional for a verification badge that helps build trust with other users</li>
          </ul>
          <p className="mt-2">The subscription gives you full access to the platform, including unlimited swaps and messaging.</p>
        </>
      ),
      category: 'billing'
    },
    {
      id: 'who-can-use-servswap',
      question: 'Who can use ServSwap?',
      answer: (
        <p>ServSwap is designed for anyone with skills or services to offer, including freelancers, professionals, small business owners, students, and hobbyists. You must be at least 18 years old to create an account and use our services.</p>
      ),
      category: 'general'
    },
    
    // Account Questions
    {
      id: 'how-to-create-account',
      question: 'How do I create an account?',
      answer: (
        <>
          <p>To create an account on ServSwap:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Click on the "Sign Up" button in the top right corner of the homepage</li>
            <li>Enter your email address and create a password</li>
            <li>Complete your profile information, including your name, location, and a short bio</li>
            <li>Upload a profile picture</li>
            <li>Select a subscription plan</li>
            <li>Add payment information</li>
            <li>Start using ServSwap!</li>
          </ol>
        </>
      ),
      category: 'account'
    },
    {
      id: 'delete-account',
      question: 'How do I delete my account?',
      answer: (
        <>
          <p>To delete your account:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to your Dashboard</li>
            <li>Navigate to "Settings"</li>
            <li>Scroll to the bottom of the page to find the "Delete Account" section</li>
            <li>Click on "Delete My Account"</li>
            <li>Confirm your decision</li>
          </ol>
          <p className="mt-2">Please note that account deletion is permanent and will cancel your subscription. All your data will be deleted according to our Privacy Policy.</p>
        </>
      ),
      category: 'account'
    },
    {
      id: 'get-verified',
      question: 'How do I get verified?',
      answer: (
        <>
          <p>Verification is available as an add-on to your subscription for an additional $5/month. To get verified:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to your Dashboard</li>
            <li>Navigate to "Settings" and then "Subscription"</li>
            <li>Click on "Add Verification"</li>
            <li>Complete the verification process, which may include providing additional information</li>
          </ol>
          <p className="mt-2">Once verified, a badge will appear on your profile, indicating to other users that you're a trusted member of the ServSwap community.</p>
        </>
      ),
      category: 'account'
    },
    {
      id: 'reset-password',
      question: 'I forgot my password. How do I reset it?',
      answer: (
        <>
          <p>To reset your password:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Click on the "Log In" button</li>
            <li>Select "Forgot Password"</li>
            <li>Enter the email address associated with your account</li>
            <li>Check your email for a password reset link</li>
            <li>Click the link and follow the instructions to create a new password</li>
          </ol>
          <p className="mt-2">If you don't receive the email, check your spam folder or contact our support team for assistance.</p>
        </>
      ),
      category: 'account'
    },
    
    // Services Questions
    {
      id: 'add-service',
      question: 'How do I add a service?',
      answer: (
        <>
          <p>To add a service to your profile:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to your Dashboard</li>
            <li>Navigate to "My Services"</li>
            <li>Click on "Add New Service"</li>
            <li>Fill out the service details, including title, description, category, and estimated value</li>
            <li>Upload images that showcase your work (optional but recommended)</li>
            <li>Click "Save" to publish your service</li>
          </ol>
        </>
      ),
      category: 'services'
    },
    {
      id: 'edit-service',
      question: 'How do I edit or delete a service?',
      answer: (
        <>
          <p>To edit or delete a service:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to your Dashboard</li>
            <li>Navigate to "My Services"</li>
            <li>Find the service you want to modify</li>
            <li>Click on "Edit" to modify the service details or "Delete" to remove it entirely</li>
            <li>If editing, make your changes and click "Save"</li>
            <li>If deleting, confirm your decision</li>
          </ol>
        </>
      ),
      category: 'services'
    },
    {
      id: 'service-visibility',
      question: 'Who can see the services I offer?',
      answer: (
        <p>All services you list are visible to other registered and subscribed ServSwap users. Your services will appear in the marketplace and can be found through category browsing or search. Users who are not logged in or who do not have an active subscription will not be able to see detailed service information.</p>
      ),
      category: 'services'
    },
    {
      id: 'service-types',
      question: 'What types of services can I offer?',
      answer: (
        <>
          <p>ServSwap supports a wide range of services, including but not limited to:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Creative services (design, writing, photography, etc.)</li>
            <li>Professional services (consulting, coaching, legal advice, etc.)</li>
            <li>Technical services (web development, IT support, etc.)</li>
            <li>Educational services (tutoring, language lessons, etc.)</li>
            <li>Practical services (handyman work, cleaning, gardening, etc.)</li>
            <li>Wellness services (fitness training, nutrition advice, etc.)</li>
          </ul>
          <p className="mt-2">All services must comply with our Terms of Service and must be legal in your jurisdiction.</p>
        </>
      ),
      category: 'services'
    },
    
    // Swaps Questions
    {
      id: 'initiate-swap',
      question: 'How do I initiate a service swap?',
      answer: (
        <>
          <p>To initiate a service swap:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Find a service you're interested in on the marketplace</li>
            <li>Click on the service to view details</li>
            <li>Click the "Propose Swap" button</li>
            <li>Select one of your services to offer in exchange</li>
            <li>Add a message describing what you're looking for and what you're offering</li>
            <li>Click "Send Proposal"</li>
          </ol>
          <p className="mt-2">The other user will receive your proposal and can accept, decline, or negotiate the terms.</p>
        </>
      ),
      category: 'swaps'
    },
    {
      id: 'accept-reject-swap',
      question: 'How do I accept or reject a swap proposal?',
      answer: (
        <>
          <p>When you receive a swap proposal:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to your Dashboard</li>
            <li>Navigate to "My Swaps"</li>
            <li>Find the pending proposal in the list</li>
            <li>Click on it to view details</li>
            <li>Use the "Accept" button to agree to the swap as proposed</li>
            <li>Use the "Decline" button to reject the proposal</li>
            <li>Use the messaging feature to negotiate different terms before accepting</li>
          </ol>
        </>
      ),
      category: 'swaps'
    },
    {
      id: 'complete-swap',
      question: 'How do I mark a swap as completed?',
      answer: (
        <>
          <p>After both parties have fulfilled their part of the swap:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to your Dashboard</li>
            <li>Navigate to "My Swaps"</li>
            <li>Find the active swap in the list</li>
            <li>Click on it to view details</li>
            <li>Click the "Mark as Completed" button</li>
            <li>The other user will be notified and need to confirm completion</li>
            <li>Once both users mark the swap as completed, it will be finalized</li>
          </ol>
          <p className="mt-2">After a swap is completed, you'll have the opportunity to leave an endorsement for the other user.</p>
        </>
      ),
      category: 'swaps'
    },
    {
      id: 'dispute-resolution',
      question: "What if there is a dispute or problem with my swap?",
      answer: (
        <>
          <p>If you encounter issues with a swap:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>First, try to resolve the issue directly with the other user through the messaging system</li>
            <li>If that does not resolve the problem, go to your swap details page</li>
            <li>Click the "Report an Issue" button</li>
            <li>Fill out the form with details about the problem</li>
            <li>Our support team will review the case and assist with mediation</li>
          </ol>
          <p className="mt-2">ServSwap acts as a facilitator but cannot guarantee the quality or completion of services. We encourage clear communication and setting explicit expectations before agreeing to a swap.</p>
        </>
      ),
      category: 'swaps'
    },
    
    // Billing Questions
    {
      id: 'update-payment',
      question: 'How do I update my payment information?',
      answer: (
        <>
          <p>To update your payment information:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to your Dashboard</li>
            <li>Navigate to "Settings" and then "Subscription"</li>
            <li>Click on "Update Payment Method"</li>
            <li>Enter your new payment details</li>
            <li>Click "Save Changes"</li>
          </ol>
        </>
      ),
      category: 'billing'
    },
    {
      id: 'cancel-subscription',
      question: 'How do I cancel my subscription?',
      answer: (
        <>
          <p>To cancel your subscription:</p>
          <ol className="list-decimal pl-5 mt-2 space-y-1">
            <li>Go to your Dashboard</li>
            <li>Navigate to "Settings" and then "Subscription"</li>
            <li>Click on "Cancel Subscription"</li>
            <li>Follow the prompts to confirm cancellation</li>
          </ol>
          <p className="mt-2">Your subscription will remain active until the end of the current billing period. After that, you will no longer have access to the platform's features.</p>
        </>
      ),
      category: 'billing'
    },
    {
      id: 'refund-policy',
      question: 'What is your refund policy?',
      answer: (
        <>
          <p>Our refund policy is as follows:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>New subscribers can request a full refund within 7 days of their initial payment if they are unsatisfied with the service</li>
            <li>After the first 7 days, or for recurring payments, refunds are generally not provided</li>
            <li>In exceptional circumstances (such as technical issues preventing use of the platform), we may consider refund requests on a case-by-case basis</li>
          </ul>
          <p className="mt-2">To request a refund, please contact our support team at support@servswap.com with your account details and reason for the refund request.</p>
        </>
      ),
      category: 'billing'
    },
    {
      id: 'change-plan',
      question: 'Can I change my subscription plan?',
      answer: (
        <>
          <p>Yes, you can change your subscription plan at any time:</p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>To switch between monthly and annual billing, go to "Settings" &gt; "Subscription" &gt; "Change Plan"</li>
            <li>To add or remove the verification badge, go to "Settings" &gt; "Subscription" and select the appropriate option</li>
          </ul>
          <p className="mt-2">When switching from monthly to annual billing, you'll be charged the annual fee immediately, with credit for any unused portion of your current monthly subscription. When switching from annual to monthly, the change will take effect at the end of your current annual period.</p>
        </>
      ),
      category: 'billing'
    }
  ];
  
  const filteredFAQs = activeCategory === 'all' 
    ? faqItems 
    : faqItems.filter(item => item.category === activeCategory);
  
  const categories = [
    { id: 'all', name: 'All Questions' },
    { id: 'general', name: 'General' },
    { id: 'account', name: 'Account' },
    { id: 'services', name: 'Services' },
    { id: 'swaps', name: 'Swaps' },
    { id: 'billing', name: 'Billing' },
  ];

  return (
    <div className="bg-white">
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 text-center mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-600 text-center mb-12">Find answers to the most common questions about ServSwap</p>
          
          {/* Category Tabs */}
          <div className="border-b border-gray-200 mb-10">
            <div className="flex flex-wrap -mb-px">
              {categories.map(category => (
                <button
                  key={category.id}
                  className={`inline-block py-4 px-4 text-sm font-medium ${
                    activeCategory === category.id
                      ? 'border-b-2 border-indigo-600 text-indigo-600'
                      : 'border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                  onClick={() => setActiveCategory(category.id)}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* FAQ Accordion */}
          <div className="space-y-4">
            {filteredFAQs.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  className="w-full flex justify-between items-center px-6 py-4 text-left bg-white hover:bg-gray-50 focus:outline-none"
                  onClick={() => toggleItem(item.id)}
                >
                  <span className="text-lg font-medium text-gray-900">{item.question}</span>
                  {isOpen(item.id) ? (
                    <ChevronUp className="h-5 w-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-gray-500" />
                  )}
                </button>
                
                {isOpen(item.id) && (
                  <div className="px-6 py-4 bg-gray-50">
                    <div className="text-gray-700 prose max-w-none">
                      {item.answer}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Didn't find your answer section */}
          <div className="mt-16 bg-indigo-50 rounded-lg p-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Didn't find your answer?</h2>
            <p className="text-gray-600 mb-6">Our support team is here to help you with any questions you may have.</p>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Contact Support
            </Link>
          </div>
          
          <div className="mt-10 text-center">
            <Link href="/" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 