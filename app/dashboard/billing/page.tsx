'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/app/context/AuthContext';
import { getUserSubscription, getAllUserSubscriptions } from '@/app/lib/subscriptions';
import { SubscriptionData, PLANS, getPlanById, isSubscriptionActive, isSubscriptionGracePeriod } from '@/app/lib/stripe';
import { Loader2, Calendar, CreditCard, CheckCircle, AlertTriangle, ArrowRight, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function BillingPage() {
  const { user, signOut, verificationBadge } = useAuth();
  const router = useRouter();
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [mainSubscription, setMainSubscription] = useState<SubscriptionData | null>(null);
  const [verificationSubscription, setVerificationSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [stripeSub, setStripeSub] = useState<any>(null);
  const [stripeInvoices, setStripeInvoices] = useState<any[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  // Fetch subscription data
  useEffect(() => {
    if (!user) {
      router.push('/auth/login?redirect=/dashboard/billing');
      return;
    }
    
    const fetchSubscriptions = async () => {
      setLoading(true);
      try {
        // First try getting subscriptions with Stripe's subscription ID
        let allSubs = await getAllUserSubscriptions(user.uid);
        console.log('All subscriptions:', allSubs); // Debug log
        
        // If no subscriptions found, try getting a direct document with userId
        if (allSubs.length === 0) {
          console.log('No Stripe subscriptions found, checking for placeholder subscription');
          try {
            const db = await import('@/app/lib/firebase').then(mod => mod.db);
            const { doc, getDoc } = await import('firebase/firestore');
            const placeholderSubDoc = await getDoc(doc(db, 'subscriptions', user.uid));
            
            if (placeholderSubDoc.exists()) {
              console.log('Found placeholder subscription with user ID');
              const placeholderSub = placeholderSubDoc.data() as any;
              allSubs = [placeholderSub];
            }
          } catch (err) {
            console.error('Error checking for placeholder subscription:', err);
          }
        }
        
        setSubscriptions(allSubs);
        // Find main and verification subscriptions
        const mainSub = allSubs.find(sub => sub.planId !== 'verification');
        const verificationSub = allSubs.find(sub => sub.planId === 'verification');
        console.log('mainSub:', mainSub);
        console.log('verificationSub:', verificationSub);
        setMainSubscription(mainSub || null);
        setVerificationSubscription(verificationSub || null);
      } catch (error) {
        console.error('Error fetching subscriptions:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSubscriptions();
  }, [user, router, refreshCounter]);
  
  // Update the forceRefresh function to use our new refreshSubscriptionData function
  const forceRefresh = async () => {
    console.log('Forcing data refresh...');
    
    // Force in-memory cache to be cleared
    setMainSubscription(null);
    setStripeSub(null);
    setStripeInvoices([]);
    
    // Short pause to ensure previous operations finish
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Call the more comprehensive refresh function
    await refreshSubscriptionData();
    
    // Also increment refresh counter to trigger useEffect hooks
    setRefreshCounter(prev => prev + 1);
  };

  // Update the useEffect for stripe data to properly handle refresh scenarios
  useEffect(() => {
    const fetchStripeData = async () => {
      if (!user || !mainSubscription) return;
      try {
        console.log('Fetching Stripe data with subscription ID:', mainSubscription.id);
        const res = await fetch('/api/stripe/subscription-info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            subscriptionId: mainSubscription.id, 
            customerId: mainSubscription.customerId,
            // Add cache buster to ensure fresh data
            _cache: Date.now()
          }),
        });
        const data = await res.json();
        
        // Enhanced debugging
        console.log('Received data from Stripe API:', {
          hasSubscription: !!data.subscription,
          subscriptionStatus: data.subscription?.status,
          cancelAtPeriodEnd: data.subscription?.cancel_at_period_end,
          invoiceCount: data.invoices?.length || 0
        });
        
        if (data.subscription) {
          console.log('Received Stripe subscription data:', {
            id: data.subscription.id,
            status: data.subscription.status,
            cancel_at_period_end: data.subscription.cancel_at_period_end,
            current_period_end: data.subscription.current_period_end,
          });
          
          setStripeSub(data.subscription);
          
          // If Stripe says cancel_at_period_end but our local state doesn't reflect that,
          // update the local state to match Stripe (source of truth)
          if (data.subscription.cancel_at_period_end !== mainSubscription.cancelAtPeriodEnd) {
            console.log('Updating local subscription state to match Stripe cancel_at_period_end flag', {
              stripeValue: data.subscription.cancel_at_period_end,
              localValue: mainSubscription.cancelAtPeriodEnd
            });
            setMainSubscription({
              ...mainSubscription,
              cancelAtPeriodEnd: data.subscription.cancel_at_period_end
            });
          }
        }
        
        if (data.invoices) {
          setStripeInvoices(data.invoices);
          console.log('Fetched invoices:', data.invoices?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching Stripe data:', err);
        setStripeSub(null);
        setStripeInvoices([]);
      }
    };
    fetchStripeData();
  }, [mainSubscription, user, refreshCounter]);
  
  // Cancel subscription (main or verification)
  const handleCancelSubscription = async (subscription: SubscriptionData | null) => {
    if (!user || !subscription) return;
    if (!subscription.id || !subscription.id.startsWith('sub_')) {
      alert('This subscription cannot be canceled because it is missing a valid Stripe subscription ID. Please contact support.');
      return;
    }
    
    if (window.confirm('Are you sure you want to cancel this subscription? You will keep access until the end of your billing period.')) {
      setCancelLoading(true);
      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/cancel-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`,
          },
          body: JSON.stringify({ subscriptionId: subscription.id }),
        });
        
        const data = await response.json();
        
        if (response.ok) {
          if (data.message) {
            alert(data.message);
          } else {
            alert('Your subscription has been set to cancel at the end of the billing period.');
          }
          
          // Update local state to show subscription is canceling
          if (subscription.planId === 'verification') {
            setVerificationSubscription({
              ...verificationSubscription!,
              cancelAtPeriodEnd: true,
            });
          } else {
            setMainSubscription({
              ...mainSubscription!,
              cancelAtPeriodEnd: true,
            });
          }
          
          // Only reload if necessary
          if (!data.message || !data.message.includes('already')) {
            window.location.reload();
          }
        } else {
          throw new Error(data.error || 'Failed to cancel subscription');
        }
      } catch (error: any) {
        console.error('Error canceling subscription:', error);
        alert(`Failed to cancel subscription: ${error.message}`);
      } finally {
        setCancelLoading(false);
      }
    }
  };

  // Manage subscription (main or verification)
  const handleManageSubscription = async () => {
    if (!user) return;
    setPortalLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch('/api/manage-subscription', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to access customer portal');
      }
      window.location.href = data.url;
    } catch (error) {
      console.error('Error accessing customer portal:', error);
      alert('Failed to access customer portal. Please try again.');
    } finally {
      setPortalLoading(false);
    }
  };
  
  // Update handleResumeSubscription to use refreshSubscriptionData
  const handleResumeSubscription = async () => {
    if (!user || !mainSubscription) return;
    
    setResumeLoading(true);
    try {
      // Get user's ID token for authentication
      const idToken = await user.getIdToken();
      
      console.log('Resuming subscription with ID:', mainSubscription.id);
      
      const response = await fetch('/api/resume-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ 
          subscriptionId: mainSubscription.id,
          userId: user.uid, 
          planId: mainSubscription.planId 
        }),
      });
      
      const data = await response.json();
      console.log('Resume subscription response:', data);
      
      if (!response.ok) {
        if (data.suggestion) {
          throw new Error(`${data.error} ${data.suggestion}`);
        }
        throw new Error(data.error || 'Failed to resume subscription');
      }
      
      // Immediately update local state to show optimistic UI update
      setMainSubscription({
        ...mainSubscription,
        cancelAtPeriodEnd: false,
      });
      
      alert('Your subscription has been resumed. Auto-renewal has been enabled, and your subscription will continue uninterrupted.');
      
      // Directly refresh subscription data from Stripe
      await refreshSubscriptionData();
    } catch (error: any) {
      console.error('Error resuming subscription:', error);
      
      // Better error handling with fallback to Stripe Portal
      if (error.message?.includes('use the Stripe Portal')) {
        const usePortal = window.confirm(`${error.message}\n\nWould you like to open the Stripe Portal instead?`);
        if (usePortal) {
          handleManageSubscription();
          return;
        }
      } else {
        alert(`Failed to resume subscription: ${error.message}. Please try again or contact support.`);
      }
    } finally {
      setResumeLoading(false);
    }
  };
  
  const handleChangePlan = () => {
    router.push('/pricing');
  };
  
  // Render appropriate plan information
  const renderPlanDetails = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
          <span className="ml-3 text-lg text-gray-600">Loading subscription details...</span>
        </div>
      );
    }

    // Use the same logic as dashboard layout to check for valid subscription
    const hasValidMainSubscription = subscriptions.some(
      sub => sub.planId !== 'verification' && (isSubscriptionActive(sub) || isSubscriptionGracePeriod(sub))
    );

    if (!hasValidMainSubscription) {
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center transition-all duration-300 hover:shadow-md">
          <div className="inline-flex items-center justify-center p-4 bg-red-100 rounded-full mb-4">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Subscription</h3>
          <p className="text-sm sm:text-base text-gray-600 mb-6">
            <span className="font-semibold text-red-600">Your subscription is inactive or canceled.</span><br />
            Please reactivate your subscription to continue using ServSwap features.
          </p>
          <button
            onClick={() => router.push('/pricing')}
            className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-xl hover:from-indigo-700 hover:to-indigo-800 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            Reactivate Subscription
          </button>
        </div>
      );
    }

    // Check if the subscription is in a grace period from either our Firestore data
    // or the fresh Stripe data which is more reliable
    const isSubscriptionCanceling = mainSubscription && (
      (mainSubscription.cancelAtPeriodEnd === true) || 
      (stripeSub && stripeSub.cancel_at_period_end === true)
    );

    console.log('Subscription cancellation status check:', {
      mainSubscriptionCancelAtPeriodEnd: mainSubscription?.cancelAtPeriodEnd,
      stripeSubCancelAtPeriodEnd: stripeSub?.cancel_at_period_end,
      isSubscriptionCanceling
    });

    // If canceled but still in grace period (access until end of period)
    if (isSubscriptionCanceling) {
      console.log('Displaying cancellation UI, subscription is being canceled at period end');
      return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center transition-all duration-300 hover:shadow-md">
          <div className="inline-flex items-center justify-center p-4 bg-yellow-100 rounded-full mb-4">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Subscription</h3>
          <div className="mb-4">
            <span className="text-base sm:text-lg font-semibold text-indigo-600">{getPlanById(mainSubscription?.planId || '')?.name || 'Unknown Plan'}</span>
            <span className="ml-2 text-gray-500">({mainSubscription?.interval || 'unknown'})</span>
          </div>
          <div className="mb-4">
            <span className="text-gray-700">Status: </span>
            <span className="font-semibold text-yellow-600">Canceling at period end</span>
          </div>
          <div className="mb-4">
            <span className="text-gray-700">Access until: </span>
            <span className="font-semibold">
              {mainSubscription?.currentPeriodEnd
                ? new Date(mainSubscription.currentPeriodEnd * 1000).toLocaleDateString()
                : stripeSub && stripeSub.current_period_end 
                  ? new Date(stripeSub.current_period_end * 1000).toLocaleDateString()
                  : 'Unknown (contact support)'}
            </span>
          </div>
          <p className="text-sm sm:text-base text-gray-600 mb-6">
            You will retain access to ServSwap features until the end of your current billing period. Your subscription will not auto-renew after this date.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleManageSubscription}
              className="inline-flex items-center justify-center px-5 py-2.5 border border-indigo-600 text-sm sm:text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 disabled:opacity-50"
              disabled={portalLoading}
            >
              {portalLoading ? 'Loading...' : 'Manage Subscription'}
            </button>
            <button
              onClick={handleResumeSubscription}
              className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm sm:text-base font-medium rounded-lg hover:from-green-700 hover:to-green-800 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              disabled={resumeLoading}
            >
              {resumeLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </div>
              ) : (
                'Resume Subscription'
              )}
            </button>
          </div>
        </div>
      );
    }

    // Default: active subscription UI
    console.log('Displaying active subscription UI, subscription is not being canceled');
    return (
      <div className="space-y-4 sm:space-y-6">
        {/* Main Subscription */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center transition-all duration-300 hover:shadow-md">
          <div className="inline-flex items-center justify-center p-4 bg-green-100 rounded-full mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Active Subscription</h3>
          <div className="mb-4">
            <span className="text-base sm:text-lg font-semibold text-indigo-600">{getPlanById(mainSubscription?.planId || '').name || 'Unknown Plan'}</span>
            <span className="ml-2 text-gray-500">({mainSubscription?.interval || 'unknown'})</span>
          </div>
          <div className="mb-4">
            <span className="text-gray-700">Status: </span>
            <span className="font-semibold text-green-600">Active</span>
          </div>
          <div className="mb-4">
            <span className="text-gray-700">Renews on: </span>
            <span className="font-semibold">
              {stripeSub && stripeSub.current_period_end
                ? new Date(stripeSub.current_period_end * 1000).toLocaleDateString()
                : mainSubscription?.currentPeriodEnd 
                  ? new Date(mainSubscription.currentPeriodEnd * 1000).toLocaleDateString()
                  : 'Unknown'}
            </span>
          </div>
          <p className="text-sm sm:text-base text-gray-600 mb-6">
            Your subscription is active and will automatically renew on the date shown above.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4 sm:mt-6">
            <button
              onClick={handleManageSubscription}
              className="inline-flex items-center justify-center px-5 py-2.5 border border-indigo-600 text-sm sm:text-base font-medium rounded-lg text-indigo-600 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 disabled:opacity-50"
              disabled={portalLoading}
            >
              {portalLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Loading...
                </div>
              ) : (
                'Manage Subscription'
              )}
            </button>
            <button
              onClick={() => handleCancelSubscription(mainSubscription)}
              className="inline-flex items-center justify-center px-5 py-2.5 border border-red-600 text-sm sm:text-base font-medium rounded-lg text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-300 disabled:opacity-50"
              disabled={cancelLoading}
            >
              {cancelLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Canceling...
                </div>
              ) : (
                'Cancel Subscription'
              )}
            </button>
          </div>
        </div>

        {/* Verification Subscription */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 text-center transition-all duration-300 hover:shadow-md">
          <div className="inline-flex items-center justify-center p-4 bg-indigo-100 rounded-full mb-4">
            <Shield className="h-6 w-6 text-indigo-600" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-4">Verification Badge</h3>
          {verificationBadge?.active ? (
            <div className="mb-4">
              <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full mb-2">
                <CheckCircle className="mr-1 h-4 w-4" />
                <span className="text-sm font-medium">Verified</span>
              </div>
              <div className="mt-3 text-green-700">Your badge is active and visible on your profile.</div>
              {verificationBadge.currentPeriodEnd && (
                <div className="mt-2 text-gray-700">
                  Renews on: <span className="font-semibold">{new Date(verificationBadge.currentPeriodEnd).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-sm sm:text-base text-gray-600 mb-6">
                Get a verified badge on your profile for $5/month. This helps build trust with other users.
              </p>
              <Link
                href="/dashboard/verification"
                className="inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white text-sm sm:text-base font-medium rounded-lg hover:from-indigo-700 hover:to-indigo-800 shadow-sm transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Get Verified <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    );
  };
  
  // Add a function to directly refresh subscription data at any time
  const refreshSubscriptionData = async () => {
    if (!user) return;
    
    // For debugging
    console.log('🔄 Manually refreshing subscription data...');
    
    try {
      // First get latest subscriptions from Firestore
      const allSubs = await getAllUserSubscriptions(user.uid);
      console.log('📊 Latest subscriptions from Firestore:', allSubs);
      
      setSubscriptions(allSubs);
      
      // Find main subscription
      const mainSub = allSubs.find(sub => sub.planId !== 'verification');
      if (mainSub) {
        setMainSubscription(mainSub);
        console.log('💾 Updated mainSubscription state from Firestore:', mainSub);
        
        // Now get very latest data from Stripe
        if (mainSub.id && mainSub.customerId) {
          console.log('🔍 Fetching fresh data from Stripe for subscription:', mainSub.id);
          
          const res = await fetch('/api/stripe/subscription-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              subscriptionId: mainSub.id,
              customerId: mainSub.customerId,
              _refresh: Date.now() // Force cache bypass
            }),
          });
          
          if (res.ok) {
            const data = await res.json();
            if (data.subscription) {
              console.log('⚡ Fresh Stripe data received:', {
                id: data.subscription.id,
                status: data.subscription.status,
                cancel_at_period_end: data.subscription.cancel_at_period_end
              });
              
              setStripeSub(data.subscription);
              
              // Update our local state to match Stripe's data (source of truth)
              if (data.subscription.cancel_at_period_end !== mainSub.cancelAtPeriodEnd) {
                console.log('🔄 Updating local state to match Stripe cancel_at_period_end:', 
                  data.subscription.cancel_at_period_end);
                
                setMainSubscription({
                  ...mainSub,
                  cancelAtPeriodEnd: data.subscription.cancel_at_period_end
                });
              }
              
              if (data.invoices) {
                setStripeInvoices(data.invoices);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error refreshing subscription data:', error);
    }
  };
  
  // Add an effect to call refreshSubscriptionData when the page loads
  useEffect(() => {
    if (user && mainSubscription) {
      // Wait a short time to allow initial page render
      const timer = setTimeout(() => {
        console.log('Auto-refreshing subscription data on page load...');
        refreshSubscriptionData();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [user, mainSubscription?.id]); // Only run when user or subscription ID changes
  
  return (
    <div className="p-4 sm:p-6 bg-gradient-to-br from-gray-50 via-white to-indigo-50">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <div className="inline-flex items-center justify-center p-2 bg-indigo-100 rounded-xl mb-4">
            <CreditCard className="h-6 w-6 text-indigo-600" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Billing & Subscription</h2>
          <p className="mt-1 text-sm sm:text-base text-gray-600">
            Manage your subscription and payment details
          </p>
        </div>
        
        {renderPlanDetails()}
        
        <div className="mt-8 sm:mt-10 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 transition-all duration-300 hover:shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Calendar className="mr-2 h-5 w-5 text-indigo-500" />
            Billing History
          </h3>
          
          <div className="overflow-x-auto -mx-6 sm:mx-0">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stripeInvoices.length > 0 ? (
                  stripeInvoices.map((item, idx) => {
                    // Attempt to determine which plan this invoice was for
                    let planName = "ServSwap Subscription";
                    
                    if (item.lines && item.lines.data && item.lines.data.length > 0) {
                      const lineItem = item.lines.data[0];
                      if (lineItem.plan) {
                        if (lineItem.plan.product === 'prod_verification') {
                          planName = 'Verification Badge';
                        } else {
                          // Try to determine if it's monthly or annual
                          const interval = lineItem.plan.interval;
                          planName = `ServSwap ${interval === 'year' ? 'Annual' : 'Monthly'} Plan`;
                        }
                      } else if (lineItem.description) {
                        planName = lineItem.description;
                      }
                    }
                    
                    return (
                      <tr key={item.id || idx}>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500">
                          {item.created ? new Date(item.created * 1000).toLocaleDateString() : 'Unknown'}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500 max-w-[100px] sm:max-w-none truncate">
                          {planName}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm text-gray-500">
                          ${item.amount_paid ? (item.amount_paid / 100).toFixed(2) : '0.00'}
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            item.status === 'paid' ? 'bg-green-100 text-green-800' : 
                            item.status === 'open' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status === 'paid' ? 'Paid' : 
                             item.status === 'open' ? 'Pending' : 
                             item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-3 sm:px-6 py-2 sm:py-4 text-xs sm:text-sm">
                          {item.hosted_invoice_url ? (
                            <a href={item.hosted_invoice_url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="text-indigo-600 hover:text-indigo-900">
                              Download
                            </a>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 sm:px-6 py-4 text-center text-xs sm:text-sm text-gray-500">No billing history available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
} 