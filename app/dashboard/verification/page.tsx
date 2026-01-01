'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db, storage, auth } from '../../lib/firebaseCompat';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Upload, AlertCircle, Phone, Shield, User } from 'lucide-react';
import { firebase } from '../../lib/firebaseCompat';
import { getAllUserSubscriptions } from '../../lib/subscriptions';
import { isSubscriptionActive, SubscriptionData } from '../../lib/stripe';

interface VerificationStatus {
  status: 'pending' | 'verified' | 'rejected' | 'none';
  message?: string;
  subscriptionId?: string;
}

// Extend window type for recaptchaVerifier
declare global {
  interface Window {
    recaptchaVerifier?: any;
  }
}

function hasActiveVerificationBadge(subscriptions: SubscriptionData[]): boolean {
  return subscriptions.some(
    (sub: SubscriptionData) => sub.planId === 'verification' && isSubscriptionActive(sub)
  );
}

export default function VerificationPage() {
  const { user, verificationBadge } = useAuth();
  const router = useRouter();
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>({ status: 'none' });
  const [phone, setPhone] = useState('+1');
  const [code, setCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [hasActiveBadge, setHasActiveBadge] = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Log environment and test mode status
    console.log('[VerificationPage] NODE_ENV:', process.env.NODE_ENV, 'window?', typeof window !== 'undefined');
    // Check if appVerificationDisabledForTesting is set (if possible)
    try {
      const auth = firebase.auth();
      // @ts-ignore
      if (auth.settings) {
        // @ts-ignore
        console.log('[VerificationPage] appVerificationDisabledForTesting:', auth.settings.appVerificationDisabledForTesting);
      } else {
        console.log('[VerificationPage] auth.settings is not available');
      }
    } catch (e) {
      console.error('[VerificationPage] Error checking appVerificationDisabledForTesting:', e);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    checkVerificationStatus();
    (async () => {
      const subs = await getAllUserSubscriptions(user.uid);
      const badgeSub = hasActiveVerificationBadge(subs);
      setHasActiveBadge(!!badgeSub);
    })();
  }, [user]);

  const checkVerificationStatus = async () => {
    if (!user) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.verification) {
          setVerificationStatus(userData.verification);
        }
      }
    } catch (error) {
      setError('Failed to check verification status');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/[^\d+]/g, ''); // Only allow digits and +
    if (!value.startsWith('+')) {
      value = '+1' + value.replace(/^1+/, ''); // Remove leading 1s if present
    }
    setPhone(value);
    setSuccess(null); // Clear success message when phone changes
  };

  const handleSendCode = async () => {
    setError(null);
    setSuccess(null);
    setIsSending(true);
    setConfirmationResult(null);
    try {
      const auth = firebase.auth();
      auth.settings.appVerificationDisabledForTesting = true;
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new firebase.auth.RecaptchaVerifier(
          recaptchaRef.current || 'recaptcha-container',
          { size: 'invisible' }
        );
        await window.recaptchaVerifier.render();
      }
      const confirmation = await auth.signInWithPhoneNumber(phone, window.recaptchaVerifier);
      setConfirmationResult(confirmation);
      setSuccess('Verification code sent! Please check your phone and enter the code.');
    } catch (err: any) {
      setError(err.message || 'Failed to send code. Please check your phone number format and try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    setIsVerifying(true);
    try {
      if (!confirmationResult) {
        setError('Please request a code first.');
        setIsVerifying(false);
        return;
      }
      // Use compat SDK to get credential and link to current user
      const credential = firebase.auth.PhoneAuthProvider.credential(
        confirmationResult.verificationId,
        code
      );
      const currentUser = firebase.auth().currentUser;
      if (currentUser) {
        await currentUser.linkWithCredential(credential);
        if (user) {
          await updateDoc(doc(db, 'users', user.uid), {
            verification: {
              status: 'verified',
              message: 'Phone number verified',
              phone,
              verifiedAt: new Date().toISOString(),
            },
          });
          setVerificationStatus({ status: 'verified', message: 'Phone number verified' });
        }
      } else {
        setError('No user is currently signed in.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubscribe = async () => {
    if (!user) return;
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          planId: 'verification',
          interval,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to start checkout.');
      }
    } catch (error) {
      setError('Failed to process subscription. Please try again.');
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-gray-50 via-white to-indigo-50 min-h-screen">
      <div className="max-w-2xl mx-auto">
        {/* reCAPTCHA container for Firebase Phone Auth */}
        <div ref={recaptchaRef} id="recaptcha-container"></div>
        
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 hover:shadow-md">
          <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-indigo-100">
            <div className="flex items-center">
              <div className="bg-white p-2 rounded-lg shadow-sm mr-3">
                <Shield className="h-5 w-5 text-indigo-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Get Verified</h1>
            </div>
          </div>
          
          <div className="p-6">
            {/* Show congrats if badge is active */}
            {verificationBadge?.active ? (
              <div className="mb-6 p-6 rounded-xl bg-gradient-to-r from-green-50 to-green-100 text-center border border-green-200">
                <div className="flex flex-col items-center">
                  <div className="bg-white p-3 rounded-full shadow-sm mb-4">
                    <CheckCircle className="h-10 w-10 text-green-500" />
                  </div>
                  <h2 className="text-xl font-bold text-green-800 mb-2">Congratulations!</h2>
                  <p className="text-green-700 max-w-md mx-auto">
                    You are now verified and your badge is active. Your profile now displays a verification badge
                    that helps build trust with other users.
                  </p>
                  
                  <div className="mt-4 p-3 bg-white rounded-lg shadow-sm inline-block">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-gray-600" />
                      <span className="text-gray-800 font-medium">Your Profile</span>
                      <CheckCircle className="h-5 w-5 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            
            {/* Phone verification UI if not verified */}
            {(verificationStatus.status as string) !== 'verified' && (
              <div className="mb-6 rounded-xl overflow-hidden border border-indigo-100">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 text-white">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Step 1: Verify your phone number
                  </h2>
                </div>
                
                <div className="p-6 bg-white">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
                      <div className="mt-1 relative rounded-md shadow-sm">
                        <input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={handlePhoneChange}
                          className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                          disabled={isSending || (verificationStatus.status as string) === 'verified'}
                        />
                      </div>
                      <button
                        onClick={handleSendCode}
                        className="mt-3 w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-lg shadow-sm hover:from-indigo-700 hover:to-indigo-800 transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        disabled={isSending || (verificationStatus.status as string) === 'verified'}
                      >
                        {isSending ? (
                          <div className="flex items-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Sending...
                          </div>
                        ) : (
                          'Send Verification Code'
                        )}
                      </button>
                      {success && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200 flex items-start">
                          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                          <span className="text-green-700 text-sm">{success}</span>
                        </div>
                      )}
                    </div>
                    
                    {confirmationResult && (
                      <div className="space-y-2 border-t pt-5">
                        <label htmlFor="code" className="block text-sm font-medium text-gray-700">Verification Code</label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            id="code"
                            type="text"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            className="block w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            disabled={isVerifying || (verificationStatus.status as string) === 'verified'}
                            placeholder="Enter code from SMS"
                          />
                        </div>
                        <button
                          onClick={handleVerifyCode}
                          className="mt-3 w-full flex items-center justify-center px-4 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-medium rounded-lg shadow-sm hover:from-green-700 hover:to-green-800 transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                          disabled={isVerifying || !code || (verificationStatus.status as string) === 'verified'}
                        >
                          {isVerifying ? (
                            <div className="flex items-center">
                              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Verifying...
                            </div>
                          ) : (
                            'Verify Code'
                          )}
                        </button>
                      </div>
                    )}
                    
                    {error && (
                      <div className="p-3 bg-red-50 rounded-lg border border-red-200 flex items-start">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                        <span className="text-red-700 text-sm">{error}</span>
                      </div>
                    )}
                    
                    {(verificationStatus.status as string) === 'verified' && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200 flex items-start">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                        <span className="text-green-700 text-sm">Phone number verified successfully!</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Subscribe section */}
            {!verificationBadge?.active && (
              <div className="rounded-xl overflow-hidden border border-indigo-100">
                <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 text-white">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Step 2: Get Your Verification Badge
                  </h2>
                </div>
                
                <div className="p-6 bg-white">
                  <div className="mb-6 text-center">
                    <p className="text-gray-600">
                      A verification badge helps build trust with other users on the platform.
                      Get your badge for just $5/month.
                    </p>
                    
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center justify-center gap-6">
                        <label className="relative flex items-center cursor-pointer">
                          <input 
                            type="radio" 
                            value="monthly" 
                            checked={interval === 'monthly'} 
                            onChange={() => setInterval('monthly')}
                            className="sr-only peer"
                          />
                          <div className="w-5 h-5 bg-white border border-gray-300 rounded-full peer peer-checked:border-indigo-600 peer-checked:border-4"></div>
                          <span className="ml-2 text-gray-700">Monthly ($5/month)</span>
                        </label>
                        
                        <label className="relative flex items-center cursor-pointer">
                          <input 
                            type="radio" 
                            value="annual" 
                            checked={interval === 'annual'} 
                            onChange={() => setInterval('annual')}
                            className="sr-only peer" 
                          />
                          <div className="w-5 h-5 bg-white border border-gray-300 rounded-full peer peer-checked:border-indigo-600 peer-checked:border-4"></div>
                          <span className="ml-2 text-gray-700">Annual ($50/year, save $10)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleSubscribe}
                    className="w-full flex items-center justify-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-medium rounded-lg shadow-sm hover:from-indigo-700 hover:to-indigo-800 transition-all duration-300 hover:shadow-md hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    disabled={isSending || isVerifying || (verificationStatus.status as string) !== 'verified'}
                  >
                    {(verificationStatus.status as string) !== 'verified' ? (
                      'Verify Phone First'
                    ) : (
                      'Get Verified Now'
                    )}
                  </button>
                  
                  {(verificationStatus.status as string) !== 'verified' && (
                    <p className="mt-3 text-center text-sm text-red-600">
                      You need to verify your phone number first.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 