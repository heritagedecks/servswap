import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/app/lib/stripe';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Only initialize Firebase Admin if not already initialized
if (!getApps().length) {
  initializeApp();
}

export async function POST(request: NextRequest) {
  console.log('HIT /api/create-customer-portal route');
  try {
    const stripe = getStripeInstance();
    const db = getFirestore();

    // Get Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No auth token' },
        { status: 401 }
      );
    }
    const idToken = authHeader.split('Bearer ')[1];

    // Verify Firebase ID token
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (err) {
      return NextResponse.json(
        { error: 'Invalid or expired auth token' },
        { status: 401 }
      );
    }
    const userId = decodedToken.uid;

    // Get Stripe customer ID from Firestore
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    const stripeCustomerId = userData?.stripeCustomerId;
    console.log('Fetched stripeCustomerId from Firestore:', stripeCustomerId, 'Type:', typeof stripeCustomerId);
    if (!stripeCustomerId) {
      console.error('No Stripe customer ID found for user:', userId);
      return NextResponse.json(
        { error: 'No Stripe customer ID found for this user.' },
        { status: 404 }
      );
    }
    try {
      console.log('Creating portal for Stripe customer ID:', stripeCustomerId, 'Type:', typeof stripeCustomerId);
      const returnUrl = new URL('/dashboard/billing', request.url).toString();
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: returnUrl,
      });
      return NextResponse.json({ url: portalSession.url });
    } catch (err) {
      const errorObj = err as Error;
      console.error('Error creating Stripe portal session:', errorObj);
      return NextResponse.json(
        { error: errorObj.message || 'Internal server error' },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
} 