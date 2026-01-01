export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance, PLANS } from '@/app/lib/stripe';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Create a more robust Firebase Admin SDK initialization for Vercel
const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    console.log('[create-checkout-session] Firebase Admin SDK already initialized');
    return;
  }

  console.log('[create-checkout-session] Initializing Firebase Admin SDK');
  
  // Check if running in Vercel production
  if (process.env.VERCEL_ENV === 'production') {
    console.log('[create-checkout-session] Running in Vercel production environment');
    
    try {
      // For Vercel, use service account directly from environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // If you've added the service account JSON to Vercel
        console.log('[create-checkout-session] Using FIREBASE_SERVICE_ACCOUNT environment variable');
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
        console.log('[create-checkout-session] Using individual Firebase credential environment variables');
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
      console.error('[create-checkout-session] Error initializing Firebase Admin from env vars:', error);
    }
  }
  
  // Fallback to default initialization with project ID from public config
  console.log('[create-checkout-session] Using fallback Firebase initialization');
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "servswap-69ba0"
  });
};

// Initialize Firebase Admin if not already initialized
initializeFirebaseAdmin();

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  console.log('Authorization header:', authHeader);
  if (!authHeader) {
    console.log('No Authorization header received');
    return NextResponse.json({ error: 'No auth token' }, { status: 401 });
  }
  const idToken = authHeader.split('Bearer ')[1];
  console.log('ID token:', idToken ? idToken.substring(0, 20) + '...' : 'None');

  try {
    // Verify the token
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (e) {
      console.error('[create-checkout-session] Error verifying auth token:', e);
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }

    // Now you have decodedToken.uid, decodedToken.email, etc.
    const stripe = getStripeInstance();
    const data = await request.json();
    const { planId, interval } = data;
    
    if (!planId || !interval) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get the plan details
    const plan = PLANS[planId.toUpperCase() as keyof typeof PLANS];
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get the price ID for the selected interval
    const intervalKey = interval === 'month' ? 'monthly' : interval === 'year' ? 'annual' : interval;
    const priceId = plan.stripePriceId[intervalKey as 'monthly' | 'annual'];
    if (!priceId) {
      return NextResponse.json(
        { error: 'Invalid interval' },
        { status: 400 }
      );
    }
    
    // Create or retrieve customer
    let customer;
    try {
      const customers = await stripe.customers.list({
        email: decodedToken.email || undefined,
        limit: 1,
      });
      
      if (customers.data.length > 0) {
        customer = customers.data[0];
        
        // Make sure the userId is in the metadata
        if (!customer.metadata?.userId) {
          await stripe.customers.update(customer.id, {
            metadata: { userId: decodedToken.uid },
          });
        }
      } else {
        // Create a new customer
        customer = await stripe.customers.create({
          email: decodedToken.email || undefined,
          name: decodedToken.name || undefined,
          metadata: {
            userId: decodedToken.uid,
          },
        });
      }
      // Save Stripe customer ID to Firestore
      const db = getFirestore();
      const userRef = db.collection('users').doc(decodedToken.uid);
      const userSnap = await userRef.get();
      const userData = userSnap.data();
      if (!userData || userData.stripeCustomerId !== customer.id) {
        await userRef.set({ stripeCustomerId: customer.id }, { merge: true });
      }
      // Always update the customer metadata with userId
      await stripe.customers.update(customer.id, {
        metadata: { userId: decodedToken.uid }
      });
      console.log('Updated Stripe customer metadata for', customer.id, 'with userId:', decodedToken.uid);
    } catch (error) {
      console.error('Error creating/retrieving customer:', error);
      return NextResponse.json(
        { error: 'Failed to process customer information' },
        { status: 500 }
      );
    }
    
    // Get the base URL from request or environment variables
    let baseUrl = new URL(request.url).origin;
    
    // In production, check for Vercel URL
    if (process.env.VERCEL_ENV === 'production') {
      if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`;
      }
    }
    
    console.log(`Using base URL for Stripe checkout: ${baseUrl}`);
    
    // Define success and cancel URLs
    const successUrl = new URL('/dashboard/billing/success', baseUrl).toString();
    const cancelUrl = new URL('/dashboard/billing/cancel', baseUrl).toString();
    
    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          userId: decodedToken.uid,
          planId,
          interval,
        },
      },
    });
    
    if (!session.url) {
      return NextResponse.json(
        { error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

    // For local development: Create a placeholder subscription in Firestore
    // This is needed since webhooks may not reach localhost development
    try {
      // Only in development
      if (process.env.NODE_ENV === 'development') {
        console.log('Creating placeholder subscription in Firestore for local development');
        const db = getFirestore();
        
        // Create a nested structure: subscriptions > userId > collection
        const userSubscriptionsCollection = db.collection('subscriptions').doc(decodedToken.uid).collection('userSubscriptions');
        
        // Determine plan ID from the request
        const actualPlanId = planId.toLowerCase(); // Make sure planId is lowercase
        
        // Current time in seconds (Unix timestamp)
        const now = Math.floor(Date.now() / 1000);
        
        // Period end is now + 30 days for monthly or 365 days for annual
        const periodEnd = interval === 'month' 
          ? now + (30 * 24 * 60 * 60) 
          : now + (365 * 24 * 60 * 60);
        
        // Create a realistic-looking subscription ID that won't be confused with a real one
        const subscriptionDocId = `sub_placeholder_${decodedToken.uid.substring(0, 8)}`;
        
        // Save with the exact field names expected by the UI
        await userSubscriptionsCollection.doc(subscriptionDocId).set({
          id: subscriptionDocId,
          userId: decodedToken.uid,
          customerId: customer.id,
          status: 'active',
          planId: actualPlanId,
          priceId: priceId,
          interval: interval === 'month' ? 'monthly' : 'annual',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        console.log(`Created placeholder subscription in Firestore at subscriptions/${decodedToken.uid}/userSubscriptions/${subscriptionDocId}`);
        console.log(`Subscription data: planId=${actualPlanId}, interval=${interval === 'month' ? 'monthly' : 'annual'}, period_end=${new Date(periodEnd * 1000).toISOString()}`);
      }
    } catch (error) {
      console.error('Error creating placeholder subscription:', error);
      // Continue anyway since this is just a fallback
    }
    
    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 