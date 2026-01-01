import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  User,
  UserCredential,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from './firebaseCompat';

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  planId: string;
  interval: 'month' | 'year';
}

export interface SignInData {
  email: string;
  password: string;
}

export async function signUp({ name, email, password, planId, interval }: SignUpData): Promise<UserCredential> {
  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Update profile with name
    await updateProfile(user, {
      displayName: name,
    });
    
    // Create user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      displayName: name,
      email,
      planId,
      billingInterval: interval,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Create empty profile document
    await setDoc(doc(db, 'profiles', user.uid), {
      userId: user.uid,
      bio: '',
      location: '',
      portfolio: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Now redirect to Stripe checkout
    const stripe = await import('./stripe').then(mod => mod.getStripe());
    if (!stripe) {
      throw new Error('Failed to load Stripe');
    }
    
    // Create checkout session for the selected plan
    const response = await fetch('/api/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        interval,
      }),
    });
    
    const { url } = await response.json();
    
    // Redirect to Stripe checkout
    if (url && typeof window !== 'undefined') {
      window.location.href = url;
    }
    
    return userCredential;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
}

export async function signIn({ email, password }: SignInData): Promise<UserCredential> {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Error signing in:', error);
    throw error;
  }
}

export async function signOut(): Promise<void> {
  try {
    // Try to sign out from Firebase first
    await firebaseSignOut(auth);
    
    // Clear any stored credentials - try/catch each operation in case of permissions issues
    if (typeof window !== 'undefined') {
      try {
      // Clear any stored tokens or credentials
      localStorage.removeItem('firebase:authUser:servswap-69ba0:[DEFAULT]');
      } catch (storageError) {
        console.warn('Could not clear localStorage:', storageError);
        // Continue despite error
      }
      
      try {
      sessionStorage.removeItem('firebase:authUser:servswap-69ba0:[DEFAULT]');
      } catch (storageError) {
        console.warn('Could not clear sessionStorage:', storageError);
        // Continue despite error
      }
      
      // Force clear all auth-related storage
      try {
        const authKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('firebase') || key.includes('firebaseui'))) {
            authKeys.push(key);
          }
        }
        
        authKeys.forEach(key => {
          try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        });
      } catch (error) {
        console.warn('Error cleaning up localStorage keys:', error);
      }
    }
    
    // Force a reload to ensure everything is reset
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 300);
    }
  } catch (error) {
    console.error('Error signing out:', error);
    
    // Even if Firebase signOut fails, still clear local storage
    // This ensures users can at least navigate away
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('firebase:authUser:servswap-69ba0:[DEFAULT]');
        sessionStorage.removeItem('firebase:authUser:servswap-69ba0:[DEFAULT]');
      } catch (storageError) {
        // Ignore this error
      }
      
      // Force redirect to login page even if there was an error
      setTimeout(() => {
        window.location.href = '/auth/login';
      }, 300);
    }
    
    // Don't throw the error - this would prevent navigation
    console.error('Handled error during sign out:', error);
  }
}

export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    const provider = new GoogleAuthProvider();
    // Add scopes for additional profile information if needed
    provider.addScope('profile');
    provider.addScope('email');
    
    // Force account selection
    provider.setCustomParameters({
      prompt: 'select_account'
    });
    
    const userCredential = await signInWithPopup(auth, provider);
    const user = userCredential.user;
    
    // Check if user document already exists
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (!userDoc.exists()) {
      // First time sign-in, create user document
      await setDoc(userDocRef, {
        uid: user.uid,
        displayName: user.displayName || 'User',
        email: user.email,
        photoURL: user.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      
      // Create empty profile document
      await setDoc(doc(db, 'profiles', user.uid), {
        userId: user.uid,
        bio: '',
        location: '',
        portfolio: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      // Update last login
      await setDoc(userDocRef, {
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
    
    return userCredential;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
} 