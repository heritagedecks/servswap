import { initializeApp, getApps, getApp, FirebaseOptions } from 'firebase/app';
import { getAuth, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, connectStorageEmulator, FirebaseStorage } from 'firebase/storage';
import { getAnalytics } from 'firebase/analytics';
import { getDatabase, Database } from 'firebase/database';
import type { Auth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyAdLx_jYcBKhPskpQ-9Kspg2aggIyyTZUc",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "servswap-69ba0.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "servswap-69ba0",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "servswap-69ba0.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "228102942439",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:228102942439:web:b947a7abd4ac63eb1c7c42",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-41R2NG262V",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://servswap-69ba0-default-rtdb.firebaseio.com"
};

// Log Firebase initialization
console.log('Initializing Firebase with config:', { 
  projectId: firebaseConfig.projectId,
  storageBucket: firebaseConfig.storageBucket,
  appCount: getApps().length
});

// Initialize Firebase
let app: FirebaseApp;
try {
  app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  console.log('Firebase app initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase app:', error);
  throw error;
}

// Initialize services
let auth: Auth, storage: FirebaseStorage | undefined, analytics;
let db: Firestore;
let realtimeDb: Database;

try {
  auth = getAuth(app);
  auth.setPersistence(browserLocalPersistence);
  // Enable test mode for phone auth (no reCAPTCHA in local/test) ONLY in development
  if (
    typeof window !== 'undefined' &&
    process.env.NODE_ENV === 'development'
  ) {
    try {
      // @ts-ignore
      if (auth.settings) {
        // @ts-ignore
        auth.settings.appVerificationDisabledForTesting = true;
      } else {
        console.warn('auth.settings is not available for appVerificationDisabledForTesting');
      }
    } catch (e) {
      console.error('Error setting appVerificationDisabledForTesting:', e);
    }
  }
  // In production, do NOT set appVerificationDisabledForTesting; always use reCAPTCHA
  console.log('Firebase Auth initialized');
} catch (error) {
  console.error('Error initializing Firebase Auth:', error);
  throw error;
}

try {
  db = getFirestore(app);
  console.log('Firestore initialized');
} catch (error) {
  console.error('Error initializing Firestore:', error);
}

try {
  storage = getStorage(app);
  console.log('Firebase Storage initialized with bucket:', firebaseConfig.storageBucket);
} catch (error) {
  console.error('Error initializing Firebase Storage:', error);
}

// Initialize Realtime Database
try {
  realtimeDb = getDatabase(app);
  console.log('Firebase Realtime Database initialized');
} catch (error) {
  console.error('Error initializing Firebase Realtime Database:', error);
}

// Set longer timeout for storage operations (5 minutes)
const storageConfig = {
  maxOperationRetryTime: 300000, // 5 minutes
  maxUploadRetryTime: 300000, // 5 minutes
};

// Apply storage configuration if storage is available
if (storage) {
  try {
    Object.defineProperty(storage, '_customConfig', {
      value: storageConfig,
      writable: false
    });
    console.log('Applied custom config to storage');
  } catch (error) {
    console.error('Failed to apply custom config to storage:', error);
  }
}

// Initialize Analytics if we're in the browser
if (typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
    console.log('Firebase Analytics initialized');
  } catch (error) {
    console.error('Error initializing Firebase Analytics:', error);
  }
}

// Export initialized services
export { app, auth, db, storage, analytics, realtimeDb }; 