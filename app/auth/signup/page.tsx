'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { PLANS, SubscriptionPlan } from '@/app/lib/stripe';
import { Check } from 'lucide-react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

const signupSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  email: z.string().email({ message: 'Please enter a valid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  confirmPassword: z.string().min(1, { message: 'Please confirm your password' }),
  planId: z.string().min(1, { message: 'Please select a subscription plan' }),
  interval: z.enum(['month', 'year'], { message: 'Please select a billing interval' }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<'month' | 'year'>('month');
  const { signUp, signInWithGoogle, user } = useAuth();
  
  const { 
    register, 
    handleSubmit, 
    formState: { errors },
    setValue,
    watch
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      planId: '',
      interval: 'month',
    },
  });

  // Update form values when selections change
  useEffect(() => {
    if (selectedPlan) {
      setValue('planId', selectedPlan);
    }
    setValue('interval', selectedInterval);
  }, [selectedPlan, selectedInterval, setValue]);

  useEffect(() => {
    // if (user) {
    //   window.location.href = '/dashboard';
    // }
  }, [user]);

  const watchPlanId = watch('planId');
  const watchInterval = watch('interval');

  const calculateDiscount = (monthlyPrice: number) => {
    return monthlyPrice * 12 * 0.8; // 20% discount for annual billing
  };

  const onSubmit = async (data: SignupFormValues) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      // Create the user account
      const userCredential = await signUp({ 
        name: data.name,
        email: data.email, 
        password: data.password,
        planId: data.planId,
        interval: data.interval
      });

      // Get the current user and ID token
      const user = userCredential.user;
      if (!user) {
        setErrorMessage('Signup succeeded, but user not found for checkout.');
        setIsLoading(false);
        return;
      }
      const idToken = await user.getIdToken();

      // Call backend to create Stripe Checkout session
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          planId: data.planId,
          interval: data.interval,
        }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url; // Redirect to Stripe Checkout
      } else {
        setErrorMessage(result.error || 'Failed to start checkout');
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setErrorMessage(
        error.code === 'auth/email-already-in-use'
          ? 'This email is already registered. Try logging in instead.'
          : error.message || 'An error occurred during registration.'
      );
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!selectedPlan) {
      setErrorMessage('Please select a subscription plan before continuing');
      return;
    }
    setGoogleLoading(true);
    setErrorMessage(null);
    try {
      localStorage.setItem('pendingSubscription', JSON.stringify({
        planId: selectedPlan,
        interval: selectedInterval
      }));
      console.log('[Signup] Set pendingSubscription:', { planId: selectedPlan, interval: selectedInterval });
      await signInWithGoogle();
      // No need to pass planId and interval directly as it's now in localStorage
    } catch (error: any) {
      console.error('Google sign in error:', error);
      setErrorMessage(
        error.code === 'auth/popup-closed-by-user'
          ? 'Sign in was cancelled. Please try again.'
          : error.message || 'An error occurred during Google sign in.'
      );
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 w-full h-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 overflow-auto">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
            backgroundSize: '20px 20px'
          }}></div>
        </div>
      </div>
      
      <div className="w-full h-full min-h-screen flex flex-col items-center justify-center py-10 px-4 relative z-10">
        <div className="w-full max-w-4xl px-4">
          <Link href="/" className="flex justify-center mb-6">
            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-indigo-600 font-bold text-xl">S</span>
            </div>
            <span className="ml-2 text-2xl font-bold text-white self-center">
              ServSwap
            </span>
          </Link>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-white">
            Create your account
          </h2>
          <p className="mt-2 text-center text-indigo-100">
            Choose a plan and join our community of service swappers
          </p>
        </div>

        <div className="w-full max-w-5xl mt-8 px-4">
          <div className="bg-white py-8 px-6 shadow-xl rounded-xl border border-gray-100">
            {errorMessage && (
              <div className="mb-4 p-4 rounded-lg bg-red-50 border-l-4 border-red-500">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Account information */}
                <div className="space-y-5">
                  <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2">Account Information</h3>
                  
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  {...register('name')}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="John Doe"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  placeholder="you@example.com"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  {...register('password')}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  {...register('confirmPassword')}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                />
                {errors.confirmPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.confirmPassword.message}</p>
                )}
              </div>
                </div>

                {/* Plan selection */}
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 border-b border-gray-200 pb-2">Choose Your Plan</h3>
                    
                    {/* Billing toggle */}
                    <div className="mt-4 flex justify-center">
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
                    
                    {/* Plan cards */}
                    <div className="mt-6 space-y-4">
                      {Object.values(PLANS).filter(plan => plan.id !== 'verification').map((plan) => (
                        <div
                          key={plan.id}
                          className={`border rounded-lg p-4 cursor-pointer transition ${
                            selectedPlan === plan.id
                              ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                              : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                          }`}
                          onClick={() => setSelectedPlan(plan.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-gray-900">{plan.name}</h4>
                              <div className="flex items-baseline mt-1">
                                <span className="text-2xl font-bold text-indigo-600">
                                  ${selectedInterval === 'month' ? plan.price : (calculateDiscount(plan.price) / 12).toFixed(2)}
                                </span>
                                <span className="ml-1 text-sm text-gray-500">/mo</span>
                              </div>
                              {selectedInterval === 'year' && (
                                <p className="text-xs text-indigo-600 font-medium mt-1">
                                  Billed annually (${calculateDiscount(plan.price).toFixed(2)})
                                </p>
                              )}
                            </div>
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                              selectedPlan === plan.id
                                ? 'bg-indigo-500 text-white'
                                : 'border border-gray-300'
                            }`}>
                              {selectedPlan === plan.id && (
                                <Check className="h-4 w-4" />
                              )}
                            </div>
                          </div>
                          <ul className="mt-3 space-y-2">
                            {plan.features.map((feature, index) => (
                              <li key={index} className="flex items-start text-sm">
                                <Check className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                                <span className="text-gray-600">{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                    
                    {/* Hidden inputs for form submission */}
                    <input type="hidden" {...register('planId')} value={selectedPlan || ''} />
                    <input type="hidden" {...register('interval')} value={selectedInterval} />
                    
                    {errors.planId && (
                      <p className="mt-1 text-sm text-red-600">{errors.planId.message}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200 mt-6">
              <button
                type="submit"
                disabled={isLoading}
                  className="w-full py-3 px-4 rounded-lg shadow-md bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating account...
                  </div>
                  ) : `Create Account & Subscribe - $${
                      selectedPlan ? 
                        (selectedInterval === 'month' ? 
                          Object.values(PLANS).find(p => p.id === selectedPlan)?.price : 
                          (calculateDiscount(Object.values(PLANS).find(p => p.id === selectedPlan)?.price || 0) / 12).toFixed(2)
                        ) : '0.00'
                    }/mo`}
              </button>

              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link href="/auth/login" className="text-indigo-600 hover:text-indigo-500 font-medium">
                    Sign in
                  </Link>
                </p>
                </div>
              </div>
            </form>

            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Or continue with</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading || !selectedPlan}
                  className="w-full inline-flex justify-center items-center py-3 px-4 rounded-lg border border-gray-300 shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
                    <path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z" />
                    <path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z" />
                    <path fill="#4CAF50" d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z" />
                    <path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z" />
                  </svg>
                  {googleLoading ? (
                    <div className="ml-2 flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </div>
                  ) : (
                    <span className="ml-2">Continue with Google</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 