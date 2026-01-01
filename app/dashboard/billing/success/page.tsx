'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutSuccessPage() {
  const router = useRouter();
  
  // Auto-redirect after a few seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard/billing');
    }, 5000);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <div className="min-h-[80vh] flex items-center justify-center p-5">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Payment Successful!</h2>
        
        <p className="text-gray-600 mb-6">
          Thank you for your subscription. Your account has been successfully activated.
          You will receive a confirmation email shortly.
        </p>
        
        <div className="flex flex-col space-y-3">
          <Link 
            href="/dashboard/billing"
            className="inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go to Billing Dashboard
          </Link>
          
          <Link
            href="/dashboard"
            className="inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Return to Dashboard
          </Link>
        </div>
        
        <p className="text-sm text-gray-500 mt-8">
          You will be automatically redirected to your billing dashboard in 5 seconds.
        </p>
      </div>
    </div>
  );
} 