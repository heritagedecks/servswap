'use client';

import PricingPlans from '@/app/components/PricingPlans';
import Header from '@/app/components/Header';
import { useAuth } from '@/app/context/AuthContext';
import { useEffect, useState } from 'react';
import { getAllUserSubscriptions } from '@/app/lib/subscriptions';
import { isSubscriptionActive, isSubscriptionGracePeriod, getPlanById } from '@/app/lib/stripe';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function PricingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionName, setSubscriptionName] = useState('');

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Check if user has active subscription
        const subscriptions = await getAllUserSubscriptions(user.uid);
        const activeMainSub = subscriptions.find(
          sub => sub.planId !== 'verification' && 
          (isSubscriptionActive(sub) || isSubscriptionGracePeriod(sub))
        );

        if (activeMainSub) {
          setHasActiveSubscription(true);
          // Get the plan name
          const planDetails = getPlanById(activeMainSub.planId);
          setSubscriptionName(planDetails.name);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSubscription();
  }, [user, router]);

  if (loading) {
    return (
      <>
        <Header />
        <main className="bg-white min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="bg-white min-h-screen">
        <div className="py-8 px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl">
          {hasActiveSubscription ? (
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
                  You already have an active subscription
                </h1>
                <p className="mt-4 text-lg text-gray-600">
                  You're currently on the <span className="font-medium text-indigo-600">{subscriptionName}</span> plan.
                </p>
              </div>
              
              <div className="bg-white rounded-xl overflow-hidden shadow-xl border border-gray-200">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-1">
                  <div className="bg-white p-8 sm:p-10 text-center">
                    <div className="mx-auto w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
                      <CheckCircle className="h-8 w-8 text-indigo-600" />
                    </div>
                    
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">
                      Thank you for your subscription!
                    </h2>
                    
                    <p className="text-gray-600 mb-8 max-w-md mx-auto">
                      You have full access to all the features of ServSwap. Visit your billing page to manage your subscription settings.
                    </p>
                    
                    <Link 
                      href="/dashboard/billing"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md font-medium"
                    >
                      Manage your subscription <ArrowRight className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center">
                <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
                  Pricing Plans
                </h1>
                <p className="mt-4 max-w-xl mx-auto text-xl text-gray-500">
                  Choose the plan that fits your needs and start swapping services today.
                </p>
              </div>
              
              <PricingPlans />
            </>
          )}
        </div>
      </main>
    </>
  );
} 