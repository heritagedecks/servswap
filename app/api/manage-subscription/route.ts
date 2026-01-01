import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/app/lib/stripe';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Create a more robust Firebase Admin SDK initialization for Vercel
const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    console.log('[manage-subscription] Firebase Admin SDK already initialized');
    return;
  }

  console.log('[manage-subscription] Initializing Firebase Admin SDK');
  
  // Check if running in Vercel production
  if (process.env.VERCEL_ENV === 'production') {
    console.log('[manage-subscription] Running in Vercel production environment');
    
    try {
      // For Vercel, use service account directly from environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // If you've added the service account JSON to Vercel
        console.log('[manage-subscription] Using FIREBASE_SERVICE_ACCOUNT environment variable');
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
          credential: cert(serviceAccount)
        });
        return;
      }
      
      // Alternative: use project ID + client email + private key
      if (process.env.FIREBASE_PROJECT_ID && 
          process.env.FIREBASE_CLIENT_EMAIL && 
          process.env.FIREBASE_PRIVATE_KEY) {
        console.log('[manage-subscription] Using individual Firebase credential environment variables');
        initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
        return;
      }
    } catch (error) {
      console.error('[manage-subscription] Error initializing Firebase Admin from env vars:', error);
    }
  }
  
  // Fallback to default initialization with project ID from public config
  console.log('[manage-subscription] Using fallback Firebase initialization');
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "servswap-69ba0"
  });
};

// Initialize Firebase Admin
initializeFirebaseAdmin();

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const idToken = authHeader.split(' ')[1];
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json({ error: 'Invalid or expired auth token' }, { status: 401 });
    }
    const userId = decodedToken.uid;
    const db = getFirestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const stripeCustomerId = userData?.stripeCustomerId;
    if (!stripeCustomerId || typeof stripeCustomerId !== 'string' || !stripeCustomerId.startsWith('cus_')) {
      return NextResponse.json({ error: 'Invalid or missing Stripe customer ID for this user.' }, { status: 400 });
    }
    const stripe = getStripeInstance();
    
    // Get the base URL from request or environment variables
    let baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    // In production, check for Vercel URL
    if (process.env.VERCEL_ENV === 'production') {
      if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`;
      }
    }
    
    // Or use the request origin if available
    const origin = req.headers.get('origin');
    if (origin) {
      baseUrl = origin;
    }
    
    console.log(`Using return URL: ${baseUrl}/dashboard`);
    
    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${baseUrl}/dashboard`,
    });
    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
} 