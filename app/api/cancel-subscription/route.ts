import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/app/lib/stripe';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Create a more robust Firebase Admin SDK initialization for Vercel
const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    console.log('[cancel-subscription] Firebase Admin SDK already initialized');
    return;
  }

  console.log('[cancel-subscription] Initializing Firebase Admin SDK');
  
  // Check if running in Vercel production
  if (process.env.VERCEL_ENV === 'production') {
    console.log('[cancel-subscription] Running in Vercel production environment');
    
    try {
      // For Vercel, use service account directly from environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // If you've added the service account JSON to Vercel
        console.log('[cancel-subscription] Using FIREBASE_SERVICE_ACCOUNT environment variable');
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
        console.log('[cancel-subscription] Using individual Firebase credential environment variables');
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
      console.error('[cancel-subscription] Error initializing Firebase Admin from env vars:', error);
    }
  }
  
  // Fallback to default initialization with project ID from public config
  console.log('[cancel-subscription] Using fallback Firebase initialization');
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "servswap-69ba0"
  });
};

// Initialize Firebase Admin
initializeFirebaseAdmin();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subscriptionId } = body;
    if (!subscriptionId || typeof subscriptionId !== 'string' || !subscriptionId.startsWith('sub_')) {
      return NextResponse.json({ error: 'Invalid or missing Stripe subscription ID.' }, { status: 400 });
    }
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
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Verify subscription belongs to user
    if (subscription.customer !== stripeCustomerId) {
      return NextResponse.json({ error: 'Subscription does not belong to this user.' }, { status: 403 });
    }
    
    // Check if subscription is already canceled or in a state that can't be modified
    if (subscription.cancel_at_period_end) {
      // Subscription is already set to cancel at period end
      return NextResponse.json({ 
        success: true, 
        message: 'Subscription is already set to cancel at period end.' 
      });
    }
    
    if (subscription.status === 'canceled') {
      // Subscription is already canceled
      return NextResponse.json({ 
        success: true, 
        message: 'Subscription is already canceled.' 
      });
    }
    
    // Only update active subscriptions
    if (subscription.status === 'active' || subscription.status === 'trialing') {
    await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
      
      // Update Firestore if needed
      try {
        await db.collection('subscriptions').doc(subscriptionId).update({
          cancelAtPeriodEnd: true,
          updatedAt: new Date()
        });
      } catch (dbError) {
        console.error('Failed to update Firestore subscription:', dbError);
        // Continue anyway since Stripe is the source of truth
      }
      
      return NextResponse.json({ 
        success: true,
        message: 'Subscription will be canceled at the end of the billing period.'
      });
    } else {
      // Other subscription statuses (incomplete, incomplete_expired, past_due, unpaid)
      return NextResponse.json({ 
        error: `Cannot cancel subscription with status: ${subscription.status}`,
        status: subscription.status
      }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Error canceling subscription:', err);
    return NextResponse.json({ 
      error: err.message || 'Failed to cancel subscription'
    }, { status: 400 });
  }
} 