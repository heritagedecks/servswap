'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, MessageCircle, Book, HelpCircle, FileText } from 'lucide-react';
import Header from '../components/Header';

export default function SupportPage() {
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <>
      <Header />
      <div className="bg-white">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-4xl font-bold text-gray-900 text-center mb-4">Support Center</h1>
            <p className="text-xl text-gray-600 text-center mb-12">We're here to help you get the most out of ServSwap</p>
            
            {/* Help Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-sm p-8 border border-indigo-100">
                <div className="flex items-center mb-6">
                  <div className="bg-indigo-100 rounded-full p-3 mr-4">
                    <MessageCircle className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900">Contact Us</h2>
                </div>
                <p className="text-gray-600 mb-6">Have a specific question or issue? Our support team is ready to help you.</p>
                <Link
                  href="/contact"
                  className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Get in touch <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow-sm p-8 border border-indigo-100">
                <div className="flex items-center mb-6">
                  <div className="bg-indigo-100 rounded-full p-3 mr-4">
                    <HelpCircle className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h2 className="text-2xl font-semibold text-gray-900">FAQ</h2>
                </div>
                <p className="text-gray-600 mb-6">Find answers to the most common questions about using ServSwap.</p>
                <Link
                  href="/faq"
                  className="inline-flex items-center text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View FAQs <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </div>
            
            {/* Help Categories */}
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">Help by Category</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:border-indigo-300 hover:shadow transition-all">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Getting Started</h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#how-to-create-account" className="hover:text-indigo-600">Creating an account</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#add-service" className="hover:text-indigo-600">Adding your first service</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#get-verified" className="hover:text-indigo-600">Getting verified</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/how-it-works" className="hover:text-indigo-600">How ServSwap works</Link>
                  </li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:border-indigo-300 hover:shadow transition-all">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Service Swaps</h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#initiate-swap" className="hover:text-indigo-600">Initiating a swap</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#accept-reject-swap" className="hover:text-indigo-600">Accepting proposals</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#complete-swap" className="hover:text-indigo-600">Completing a swap</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#dispute-resolution" className="hover:text-indigo-600">Resolving disputes</Link>
                  </li>
                </ul>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 hover:border-indigo-300 hover:shadow transition-all">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Account & Billing</h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#update-payment" className="hover:text-indigo-600">Updating payment info</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#cancel-subscription" className="hover:text-indigo-600">Canceling subscription</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#change-plan" className="hover:text-indigo-600">Changing plans</Link>
                  </li>
                  <li className="flex items-center">
                    <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mr-2"></div>
                    <Link href="/faq#refund-policy" className="hover:text-indigo-600">Refund policy</Link>
                  </li>
                </ul>
              </div>
            </div>
            
            {/* Need More Help Section */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow-md p-8 mb-16 text-white">
              <h2 className="text-2xl font-bold mb-4">Need More Help?</h2>
              <p className="mb-6">Our team is available to assist you with any questions or technical issues you might be experiencing.</p>
              <div className="flex items-center">
                <MessageCircle className="h-5 w-5 mr-2 text-indigo-200" />
                <span>support@servswap.com</span>
              </div>
            </div>
            
            {/* User Guides */}
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">User Guides</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 flex">
                <div className="mr-4">
                  <Book className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">New User Guide</h3>
                  <p className="text-gray-600 mb-4">A comprehensive walkthrough for first-time users covering everything from signup to your first service swap.</p>
                  <Link
                    href="/how-it-works"
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Read the guide
                  </Link>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200 flex">
                <div className="mr-4">
                  <FileText className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Policy Documentation</h3>
                  <p className="text-gray-600 mb-4">Detailed information about our terms of service, privacy policy, and other important documents.</p>
                  <Link
                    href="/terms"
                    className="text-indigo-600 hover:text-indigo-700 font-medium mr-4"
                  >
                    Terms of Service
                  </Link>
                  <Link
                    href="/privacy"
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
            
            <div className="mt-10 text-center">
              <Link href="/" className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 