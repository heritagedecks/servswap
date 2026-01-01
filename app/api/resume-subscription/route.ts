import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/app/lib/stripe';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Create a more robust Firebase Admin SDK initialization for Vercel
const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    console.log('[resume-subscription] Firebase Admin SDK already initialized');
    return;
  }

  console.log('[resume-subscription] Initializing Firebase Admin SDK');
  
  // Check if running in Vercel production
  if (process.env.VERCEL_ENV === 'production') {
    console.log('[resume-subscription] Running in Vercel production environment');
    
    try {
      // For Vercel, use service account directly from environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // If you've added the service account JSON to Vercel
        console.log('[resume-subscription] Using FIREBASE_SERVICE_ACCOUNT environment variable');
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
        console.log('[resume-subscription] Using individual Firebase credential environment variables');
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
      console.error('[resume-subscription] Error initializing Firebase Admin from env vars:', error);
    }
  }
  
  // Fallback to default initialization with project ID from public config
  console.log('[resume-subscription] Using fallback Firebase initialization');
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "servswap-69ba0"
  });
};

// Initialize Firebase Admin if not already initialized
initializeFirebaseAdmin();

// Helper to set CORS headers
const setCorsHeaders = (res: NextResponse) => {
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Origin', '*'); // Replace with your domain in production
  res.headers.set('Access-Control-Allow-Methods', 'GET,DELETE,PATCH,POST,PUT');
  res.headers.set(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );
  return res;
};

// Handle OPTIONS requests for CORS
export async function OPTIONS(request: NextRequest) {
  const response = NextResponse.json({}, { status: 200 });
  return setCorsHeaders(response);
}

export async function POST(request: NextRequest) {
  try {
    console.log('[resume-subscription] API called');
    
    // Parse request JSON safely
    let body;
    try {
      body = await request.json();
      console.log('[resume-subscription] Request body:', JSON.stringify(body));
    } catch (parseError) {
      console.error('[resume-subscription] Failed to parse request JSON:', parseError);
      return setCorsHeaders(NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 }));
    }
    
    const { subscriptionId, userId } = body;
    
    // Validate required fields
    if (!subscriptionId) {
      console.error('[resume-subscription] Missing subscriptionId in request');
      return setCorsHeaders(NextResponse.json({ error: 'Missing subscriptionId' }, { status: 400 }));
    }
    
    if (!userId) {
      console.error('[resume-subscription] Missing userId in request');
      return setCorsHeaders(NextResponse.json({ error: 'Missing userId' }, { status: 400 }));
    }
    
    // Validate subscription ID
    if (!subscriptionId.startsWith('sub_')) {
      console.error('[resume-subscription] Invalid subscription ID format:', subscriptionId);
      return setCorsHeaders(NextResponse.json({ error: 'Invalid subscription ID format' }, { status: 400 }));
    }
    
    // Verify authentication using Firebase Admin
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[resume-subscription] Missing authorization header');
      return setCorsHeaders(NextResponse.json({ error: 'Missing authorization header' }, { status: 401 }));
    }
    
    const idTokenParts = authHeader.split(' ');
    if (idTokenParts.length !== 2) {
      console.error('[resume-subscription] Invalid authorization header format:', authHeader);
      return setCorsHeaders(NextResponse.json({ error: 'Invalid authorization header format' }, { status: 401 }));
    }
    
    const idToken = idTokenParts[1];
    console.log('[resume-subscription] Auth token length:', idToken.length);
    
    let decodedToken;
    try {
      const auth = getAuth();
      console.log('[resume-subscription] Verifying token with Firebase Auth');
      decodedToken = await auth.verifyIdToken(idToken, true); // Force token refresh check
      console.log('[resume-subscription] Token verified successfully for user:', decodedToken.uid);
    } catch (authErr: any) {
      console.error('[resume-subscription] Firebase token verification failed:', {
        error: authErr.message,
        code: authErr.code,
        stack: authErr.stack
      });
      
      // For production debugging, still allow the user if user ID matches
      if (process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production') {
        console.log('[resume-subscription] Production environment detected, continuing without auth verification');
        return setCorsHeaders(NextResponse.json({ 
          error: `Auth verification failed: ${authErr.message}. Please try again or use the Stripe Portal directly.`,
          suggestion: 'Please use the "Manage Subscription" button instead, which will open the Stripe Customer Portal'
        }, { status: 401 }));
      }
      
      return setCorsHeaders(NextResponse.json({ 
        error: `Invalid or expired auth token: ${authErr.message}`,
        errorDetails: authErr.code || 'unknown_error',
        suggestion: 'Try refreshing the page or use the Stripe Customer Portal directly'
      }, { status: 401 }));
    }
    
    const authenticatedUserId = decodedToken.uid;
    if (authenticatedUserId !== userId) {
      console.error('[resume-subscription] User ID mismatch:', { authUserId: authenticatedUserId, requestUserId: userId });
      return setCorsHeaders(NextResponse.json({ error: 'User ID does not match authenticated user' }, { status: 403 }));
    }
    
    // Get Stripe instance
    const stripe = getStripeInstance();
    
    // Get current subscription from Stripe to verify ownership
    console.log('[resume-subscription] Retrieving subscription from Stripe:', subscriptionId);
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
      console.log('[resume-subscription] Retrieved subscription:', {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end
      });
    } catch (stripeError: any) {
      console.error('[resume-subscription] Failed to retrieve subscription from Stripe:', stripeError);
      return setCorsHeaders(NextResponse.json({ 
        error: `Failed to retrieve subscription: ${stripeError.message}`
      }, { status: 400 }));
    }
    
    // Get Firestore database reference
    const db = getFirestore();
    
    // Get user document to verify Stripe customer
    console.log('[resume-subscription] Retrieving user document:', userId);
    let userDoc;
    try {
      userDoc = await db.collection('users').doc(userId).get();
      if (!userDoc.exists) {
        console.error('[resume-subscription] User not found:', userId);
        return setCorsHeaders(NextResponse.json({ error: 'User not found' }, { status: 404 }));
      }
    } catch (dbError: any) {
      console.error('[resume-subscription] Error retrieving user document:', dbError);
      return setCorsHeaders(NextResponse.json({ 
        error: `Database error: ${dbError.message}` 
      }, { status: 500 }));
    }
    
    const userData = userDoc.data();
    const stripeCustomerId = userData?.stripeCustomerId;
    console.log('[resume-subscription] User Stripe customer ID:', stripeCustomerId);
    
    // Verify subscription belongs to user
    if (subscription.customer !== stripeCustomerId) {
      console.error('[resume-subscription] Subscription customer mismatch:', {
        subscriptionCustomer: subscription.customer,
        userCustomer: stripeCustomerId
      });
      return setCorsHeaders(NextResponse.json({ error: 'Subscription does not belong to this user' }, { status: 403 }));
    }
    
    // Check if already resumed (not scheduled for cancellation)
    if (subscription.cancel_at_period_end === false) {
      console.log('[resume-subscription] Subscription already active and not scheduled for cancellation');
      return setCorsHeaders(NextResponse.json({ 
        success: true,
        message: 'Subscription is already active and not scheduled for cancellation'
      }));
    }
    
    console.log(`[resume-subscription] Resuming subscription ${subscriptionId} for user ${userId}`);
    
    // Resume the subscription in Stripe
    try {
      const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      console.log('[resume-subscription] Successfully updated subscription in Stripe:', {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end
      });
    } catch (stripeUpdateError: any) {
      console.error('[resume-subscription] Failed to update subscription in Stripe:', stripeUpdateError);
      return setCorsHeaders(NextResponse.json({ 
        error: `Failed to update subscription in Stripe: ${stripeUpdateError.message}`
      }, { status: 400 }));
    }
    
    // Update Firestore
    try {
      // First, update in the subscriptions collection
      const subscriptionRef = db.collection('subscriptions').doc(subscriptionId);
      await subscriptionRef.update({
        cancelAtPeriodEnd: false,
        updatedAt: new Date()
      });
      
      console.log(`[resume-subscription] Updated subscription ${subscriptionId} in Firestore`);
    } catch (dbErr: any) {
      console.error('[resume-subscription] Error updating Firestore subscription:', dbErr);
      // Continue anyway as Stripe is the source of truth
    }
    
    const successResponse = NextResponse.json({ 
      success: true,
      message: 'Subscription successfully resumed'
    });
    
    return setCorsHeaders(successResponse);
  } catch (error: any) {
    console.error('[resume-subscription] Unhandled error:', error);
    const errorResponse = NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
    
    return setCorsHeaders(errorResponse);
  }
} 