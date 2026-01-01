'use client';

import { useState, useEffect } from 'react';
import { PLANS, SubscriptionPlan } from '@/app/lib/stripe';
import { useAuth } from '@/app/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Check, X, CircleCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { getAllUserSubscriptions } from '@/app/lib/subscriptions';
import { isSubscriptionActive, isSubscriptionGracePeriod } from '@/app/lib/stripe';
import { getPlanById } from '@/app/lib/stripe';

export default function PricingPlans() {
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month');
  const [isLoading, setIsLoading] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionName, setSubscriptionName] = useState('');
  const [checkingSubscription, setCheckingSubscription] = useState(true);
  const { user } = useAuth();
  const router = useRouter();

  // Check if user has an active subscription
  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) {
        setCheckingSubscription(false);
        return;
      }

      try {
        const subscriptions = await getAllUserSubscriptions(user.uid);
        const activeMainSub = subscriptions.find(
          sub => sub.planId !== 'verification' && 
          (isSubscriptionActive(sub) || isSubscriptionGracePeriod(sub))
        );
        
        if (activeMainSub) {
          setHasActiveSubscription(true);
          // Get the plan name using getPlanById helper
          const planDetails = getPlanById(activeMainSub.planId);
          setSubscriptionName(planDetails.name);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      } finally {
        setCheckingSubscription(false);
      }
    };

    checkSubscription();
  }, [user]);
  
  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user) {
      // Redirect to login if not logged in
      router.push('/auth/login?redirect=/pricing');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Get Firebase ID token
      const idToken = await user.getIdToken();
      // Call the API endpoint to create a checkout session
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          planId: plan.id,
          interval: selectedInterval,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Checkout error:', data.error);
        alert(data.error || 'Failed to create checkout session. Please try again.');
        return;
      }
      
      // Redirect to Stripe checkout
      window.location.href = data.url;
    } catch (error) {
      console.error('Error initiating checkout:', error);
      alert('Failed to initiate checkout. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const calculateDiscount = (monthlyPrice: number) => {
    return monthlyPrice * 12 * 0.8; // 20% discount for annual billing
  };
  
  return (
    <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Simple, transparent pricing
        </h2>
        <p className="mt-4 text-xl text-gray-600">
          Choose the plan that fits your needs
        </p>
      </div>
      
      {/* Pricing toggle */}
      <div className="mt-12 flex justify-center">
        <div className="relative flex rounded-lg bg-gray-100 p-1">
          <button
            type="button"
            className={`relative py-2 px-6 font-medium rounded-md text-sm focus:outline-none transition ${
              selectedInterval === 'month'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-700 hover:text-gray-900'
            }`}
            onClick={() => setSelectedInterval('month')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`relative py-2 px-6 font-medium rounded-md text-sm focus:outline-none transition ${
              selectedInterval === 'year'
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-700 hover:text-gray-900'
            }`}
            onClick={() => setSelectedInterval('year')}
          >
            Yearly <span className="ml-1 text-indigo-600">Save 20%</span>
          </button>
        </div>
      </div>
      
      {/* Pricing Cards */}
      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {Object.values(PLANS)
          .filter(plan => plan.id !== 'verification')
          .map((plan) => (
          <div
            key={plan.id}
            className={`rounded-lg shadow-lg divide-y divide-gray-200 ${
              plan.id === 'pro' ? 'ring-2 ring-indigo-600' : ''
            }`}
          >
            <div className="p-6 space-y-4">
              <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
              <div className="flex items-baseline">
                <span className="text-5xl font-extrabold tracking-tight text-gray-900">
                  ${selectedInterval === 'month' ? plan.price : (calculateDiscount(plan.price) / 12).toFixed(2)}
                </span>
                <span className="ml-1 text-xl font-medium text-gray-500">
                  /mo
                </span>
              </div>
              {selectedInterval === 'year' && (
                <p className="text-sm text-indigo-600 font-medium">
                  Billed annually (${calculateDiscount(plan.price).toFixed(2)})
                </p>
              )}
              <button
                type="button"
                className={`w-full py-3 px-4 rounded-md shadow-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${
                  plan.id === 'pro'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-indigo-600 border border-indigo-600 hover:bg-indigo-50'
                }`}
                onClick={() => handleSubscribe(plan)}
                disabled={isLoading || hasActiveSubscription}
              >
                {isLoading ? 'Processing...' : 
                 hasActiveSubscription ? 'Already Subscribed' : 
                 `Subscribe to ${plan.name}`}
              </button>
            </div>
            <div className="pt-6 pb-8 px-6">
              <h4 className="text-sm font-medium text-gray-900 tracking-wide uppercase">
                What&apos;s included
              </h4>
              <ul className="mt-4 space-y-3">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0">
                      <Check className="h-5 w-5 text-green-500" />
                    </div>
                    <p className="ml-3 text-base text-gray-700">{feature}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-12 text-center">
        <p className="text-gray-600">
          All plans include immediate access to ServSwap features upon subscription.
        </p>
      </div>
    </div>
  );
} 