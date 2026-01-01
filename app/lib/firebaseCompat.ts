import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import 'firebase/compat/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: 'servswap-69ba0',
  storageBucket: 'servswap-69ba0.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log('[firebaseCompat] Firebase config:', firebaseConfig);

let app;
if (!firebase.apps.length) {
  app = firebase.initializeApp(firebaseConfig);
  console.log('[firebaseCompat] Firebase app initialized');
} else {
  app = firebase.app();
  console.log('[firebaseCompat] Firebase app already initialized');
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

export { firebase, app, auth, db, storage }; 