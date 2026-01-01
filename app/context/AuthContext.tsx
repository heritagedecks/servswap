'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { User } from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { onAuthStateChange, signIn, signOut, signUp, signInWithGoogle, SignInData, SignUpData } from '../lib/auth';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { getUserSubscription, getAllUserSubscriptions, getUserVerificationBadge } from '@/app/lib/subscriptions';
import { isSubscriptionActive, SubscriptionData } from '@/app/lib/stripe';
import { updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';

console.log('=== AuthContext loaded ===');

// Define a custom error type
interface AuthError {
  message: string;
  code?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  initialized: boolean;
  signIn: (data: SignInData) => Promise<void>;
  signUp: (data: SignUpData) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  error: string | null;
  verificationBadge?: any | null;
  updateUserProfile: (photoURL: string, displayName?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function hasActiveMainPlan(subscriptions: SubscriptionData[]): boolean {
  return subscriptions.some(
    (sub: SubscriptionData) => isSubscriptionActive(sub) && sub.planId !== 'verification'
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationBadge, setVerificationBadge] = useState<any | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChange((authUser) => {
      console.log('Auth state changed:', authUser ? `User ${authUser.uid}` : 'No user');
      if (authUser) {
        setUser(authUser);
      } else {
        setUser(null);
      }
      setLoading(false);
      setInitialized(true);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const sessionKey = 'firebase:authUser:servswap-69ba0:[DEFAULT]';
        const persistedUser = localStorage.getItem(sessionKey);
        
        if (persistedUser) {
          console.log('Found persisted user session in localStorage');
        } else {
          console.log('No persisted user session found in localStorage');
          if (!initialized) {
            setInitialized(true);
          }
        }
      } catch (err) {
        console.error('Error checking persisted auth:', err);
        if (!initialized) {
          setInitialized(true);
        }
      }
    }
  }, [initialized]);

  useEffect(() => {
    console.log('[CheckoutEffect] useEffect running, user:', user);
    if (typeof window !== 'undefined' && user) {
      const pending = localStorage.getItem('pendingSubscription');
      console.log('[CheckoutEffect] pendingSubscription in localStorage:', pending);
      if (pending) {
        const { planId, interval } = JSON.parse(pending);
        localStorage.removeItem('pendingSubscription');
        console.log('[CheckoutEffect] Removed pendingSubscription from localStorage');
        console.log('[CheckoutEffect] About to get ID token');
        user.getIdToken()
          .then((idToken: string) => {
            if (!idToken) {
              console.error('[CheckoutEffect] No ID token retrieved!');
              return;
            }
            const headers = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            };
            const body = JSON.stringify({ planId, interval });
            console.log('[CheckoutEffect] ID token:', idToken ? idToken.substring(0, 20) + '...' : 'None');
            console.log('[CheckoutEffect] Fetch headers:', headers);
            console.log('[CheckoutEffect] Fetch body:', body);
            fetch('/api/create-checkout-session', {
              method: 'POST',
              headers,
              body,
            })
              .then(res => {
                console.log('[CheckoutEffect] Fetch response status:', res.status);
                return res.json();
              })
              .then(result => {
                console.log('[CheckoutEffect] Fetch result:', result);
                if (result.url) {
                  window.location.href = result.url;
                } else {
                  alert(result.error || 'Failed to start checkout. Please try again or contact support.');
                }
              })
              .catch(err => {
                console.error('[CheckoutEffect] Network error during checkout:', err);
                alert('Network error while starting checkout. Please try again.');
              });
          })
          .catch(err => {
            console.error('[CheckoutEffect] Error getting ID token:', err);
          });
      }
    }
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      const pathname = window.location.pathname;
      // Don't redirect if already on pricing, auth, or during checkout
      if (
        pathname.startsWith('/intro') ||
        pathname.startsWith('/pricing') ||
        pathname.startsWith('/auth') ||
        pathname.startsWith('/api') ||
        pathname.startsWith('/dashboard/billing/success') ||
        pathname.startsWith('/dashboard/billing/cancel')
      ) {
        return;
      }
      // Check subscription
      getAllUserSubscriptions(user.uid).then((subscriptions) => {
        if (!subscriptions.length) {
          console.warn('No subscriptions found for user', user.uid);
        }
        const hasMain = hasActiveMainPlan(subscriptions);
        if (!hasMain) {
          window.location.href = '/pricing';
        }
      });
    }
  }, [user, loading]);

  useEffect(() => {
    if (user) {
      getUserVerificationBadge(user.uid).then(setVerificationBadge);
    } else {
      setVerificationBadge(null);
    }
  }, [user]);

  const handleSignIn = async (data: SignInData) => {
    setError(null);
    try {
      setLoading(true);
      await signIn(data);
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as AuthError;
      setError(error.message || 'An error occurred during sign in');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (data: SignUpData) => {
    setError(null);
    try {
      setLoading(true);
      return await signUp(data);
    } catch (err: unknown) {
      const error = err as AuthError;
      setError(error.message || 'An error occurred during sign up');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    console.log('[GoogleSignIn] function called');
    setError(null);
    try {
      setLoading(true);
      await signInWithGoogle();
      // After Google sign-in, check for pending subscription
      if (typeof window !== 'undefined') {
        const pending = localStorage.getItem('pendingSubscription');
        if (pending) {
          const { planId, interval } = JSON.parse(pending);
          // Get the ID token
          const user = firebase.auth().currentUser;
          if (user) {
            const idToken = await user.getIdToken();
            const headers = {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`,
            };
            const body = JSON.stringify({ planId, interval });
            console.log('[GoogleSignIn] ID token:', idToken ? idToken.substring(0, 20) + '...' : 'None');
            console.log('[GoogleSignIn] Fetch headers:', headers);
            console.log('[GoogleSignIn] Fetch body:', body);
            // Call backend to create Stripe Checkout session
            try {
              const res = await fetch('/api/create-checkout-session', {
                method: 'POST',
                headers,
                body,
              });
              const result = await res.json();
              if (result.url) {
                window.location.href = result.url;
              } else {
                console.error('[GoogleSignIn] Stripe checkout error:', result.error);
                alert(result.error || 'Failed to start checkout. Please try again or contact support.');
              }
            } catch (err) {
              console.error('[GoogleSignIn] Network error during checkout:', err);
              alert('Network error while starting checkout. Please try again.');
            }
          } else {
            console.error('[GoogleSignIn] User not found after Google sign-in.');
            alert('Google sign-in succeeded, but user not found for checkout. Please try again.');
          }
        }
      }
    } catch (err: any) {
      setError(
        err.code === 'auth/popup-closed-by-user'
          ? 'Sign in was cancelled. Please try again.'
          : err.message || 'An error occurred during Google sign in.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setError(null);
    try {
      setLoading(true);
      await signOut();
      router.push('/');
    } catch (err: unknown) {
      const error = err as AuthError;
      setError(error.message || 'An error occurred during sign out');
    } finally {
      setLoading(false);
    }
  };

  // Function to update user profile in Firebase Auth and local state
  const updateUserProfile = async (photoURL: string, displayName?: string) => {
    if (!user) return;
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('User not authenticated');
      
      const updateData: { photoURL: string; displayName?: string } = { photoURL };
      if (displayName) updateData.displayName = displayName;
      
      await updateProfile(currentUser, updateData);
      
      // Update local state with new profile data
      setUser(prevUser => {
        if (!prevUser) return null;
        
        return {
          ...prevUser,
          photoURL: photoURL,
          displayName: displayName || prevUser.displayName
        };
      });
      
      console.log('User profile updated successfully');
    } catch (err) {
      console.error('Error updating user profile:', err);
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        initialized,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signInWithGoogle: handleGoogleSignIn,
        signOut: handleSignOut,
        error,
        verificationBadge,
        updateUserProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 