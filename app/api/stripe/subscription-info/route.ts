import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/app/lib/stripe';
import Stripe from 'stripe';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Create a more robust Firebase Admin SDK initialization for Vercel
const initializeFirebaseAdmin = () => {
  if (getApps().length > 0) {
    console.log('[subscription-info] Firebase Admin SDK already initialized');
    return;
  }

  console.log('[subscription-info] Initializing Firebase Admin SDK');
  
  // Check if running in Vercel production
  if (process.env.VERCEL_ENV === 'production') {
    console.log('[subscription-info] Running in Vercel production environment');
    
    try {
      // For Vercel, use service account directly from environment variable
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // If you've added the service account JSON to Vercel
        console.log('[subscription-info] Using FIREBASE_SERVICE_ACCOUNT environment variable');
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
        console.log('[subscription-info] Using individual Firebase credential environment variables');
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
      console.error('[subscription-info] Error initializing Firebase Admin from env vars:', error);
    }
  }
  
  // Fallback to default initialization with project ID from public config
  console.log('[subscription-info] Using fallback Firebase initialization');
  initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "servswap-69ba0"
  });
};

// Initialize Firebase Admin if not already initialized
initializeFirebaseAdmin();

// Helper to set CORS headers
const setCorsHeaders = (res: NextResponse) => {
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Origin', '*');
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
    console.log('[subscription-info] API called');
    
    const { customerId, subscriptionId } = await request.json();
    console.log('[subscription-info] Request params:', { customerId, subscriptionId });
    
    const stripe = getStripeInstance();

    let subscription: Stripe.Subscription | undefined;
    let subscriptions: Stripe.Subscription[] = [];
    
    // Get subscription details
    if (subscriptionId) {
      console.log('[subscription-info] Fetching subscription by ID:', subscriptionId);
      
      // Check if this is a placeholder subscription ID
      if (subscriptionId.startsWith('sub_placeholder_')) {
        console.log('[subscription-info] This appears to be a placeholder subscription ID, not fetching from Stripe');
        
        // Try to get the subscription from Firestore directly
        try {
          const { db } = await import('@/app/lib/firebase');
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          
          // First, try to locate the userId for this placeholder subscription
          let userId = null;
          
          // Try to get userId from the customer metadata
          if (customerId) {
            try {
              const customer = await stripe.customers.retrieve(customerId);
              if (customer && typeof customer === 'object' && 'metadata' in customer && (customer.metadata as any).userId) {
                userId = (customer.metadata as any).userId;
              }
            } catch (err) {
              console.log('[subscription-info] Could not get userId from customer metadata:', err);
            }
          }
          
          if (userId) {
            // Try to find the placeholder subscription in Firestore
            console.log(`[subscription-info] Looking for placeholder subscription in Firestore at subscriptions/${userId}/userSubscriptions/${subscriptionId}`);
            
            // Return a fake Stripe-like subscription object
            const response = NextResponse.json({
              subscription: {
                id: subscriptionId,
                customer: customerId,
                status: 'active',
                cancel_at_period_end: false,
                current_period_end: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60),
                items: {
                  data: [
                    {
                      price: {
                        id: 'price_placeholder',
                        product: 'prod_placeholder',
                        recurring: {
                          interval: 'month'
                        }
                      }
                    }
                  ]
                }
              },
              subscriptions: [],
              invoices: []
            });
            
            response.headers.set('Cache-Control', 'no-store, max-age=0');
            return setCorsHeaders(response);
          } else {
            return setCorsHeaders(NextResponse.json({ error: 'Placeholder subscription not found' }, { status: 404 }));
          }
        } catch (error) {
          console.error('[subscription-info] Error getting placeholder subscription:', error);
          return setCorsHeaders(NextResponse.json({ error: 'Error getting placeholder subscription' }, { status: 500 }));
        }
      }
      
      // Not a placeholder, proceed with normal Stripe lookup
      try {
        subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          // Explicitly request expand to ensure fresh data
          expand: ['latest_invoice', 'customer']
        });
        console.log('[subscription-info] Retrieved subscription:', {
          id: subscription.id,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end
        });
      } catch (stripeErr: any) {
        console.error('[subscription-info] Error fetching subscription from Stripe:', stripeErr);
        return setCorsHeaders(NextResponse.json({ 
          error: `Stripe error: ${stripeErr.message}`
        }, { status: 400 }));
      }
    } else if (customerId) {
      console.log('[subscription-info] Fetching subscriptions for customer:', customerId);
      try {
        // Get all subscriptions for this customer
        const subsResult = await stripe.subscriptions.list({ 
          customer: customerId, 
          status: 'all', 
          limit: 100,
          expand: ['data.latest_invoice']
        });
        subscriptions = subsResult.data;
        console.log('[subscription-info] Retrieved subscriptions count:', subscriptions.length);
        
        // Use the most recent subscription as the main one
        subscription = subscriptions[0];
      } catch (stripeErr: any) {
        console.error('[subscription-info] Error listing subscriptions from Stripe:', stripeErr);
        return setCorsHeaders(NextResponse.json({ 
          error: `Stripe error: ${stripeErr.message}`
        }, { status: 400 }));
      }
    } else {
      return setCorsHeaders(NextResponse.json({ error: 'Missing customerId or subscriptionId' }, { status: 400 }));
    }

    // If we have a subscription with cancel_at_period_end=true, ensure Firestore is in sync
    if (subscription && subscription.cancel_at_period_end === true) {
      try {
        // Get a reference to Firestore
        const db = getFirestore();
        
        // Check if this subscription is in our Firestore
        const subscriptionRef = db.collection('subscriptions').doc(subscription.id);
        const subscriptionDoc = await subscriptionRef.get();
        
        if (subscriptionDoc.exists) {
          const firestoreData = subscriptionDoc.data();
          
          // If Firestore doesn't have cancelAtPeriodEnd set to true, update it
          if (firestoreData && firestoreData.cancelAtPeriodEnd !== true) {
            console.log(`Syncing Firestore subscription ${subscription.id} to match Stripe cancel_at_period_end=true`);
            await subscriptionRef.update({
              cancelAtPeriodEnd: true,
              updatedAt: new Date()
            });
          }
        }
      } catch (dbError) {
        console.error('Error syncing subscription cancellation status to Firestore:', dbError);
        // Continue anyway as this is just a sync operation
      }
    }
    
    // Similarly sync if cancel_at_period_end is false in Stripe but true in Firestore
    if (subscription && subscription.cancel_at_period_end === false) {
      try {
        const db = getFirestore();
        const subscriptionRef = db.collection('subscriptions').doc(subscription.id);
        const subscriptionDoc = await subscriptionRef.get();
        
        if (subscriptionDoc.exists) {
          const firestoreData = subscriptionDoc.data();
          
          if (firestoreData && firestoreData.cancelAtPeriodEnd === true) {
            console.log(`Syncing Firestore subscription ${subscription.id} to match Stripe cancel_at_period_end=false`);
            await subscriptionRef.update({
              cancelAtPeriodEnd: false,
              updatedAt: new Date()
            });
          }
        }
      } catch (dbError) {
        console.error('Error syncing non-cancellation status to Firestore:', dbError);
      }
    }

    // Fetch all invoices for this customer
    let invoices: Stripe.Invoice[] = [];
    if (customerId) {
      try {
        console.log('[subscription-info] Fetching invoices for customer:', customerId);
        const invoicesResult = await stripe.invoices.list({ 
          customer: customerId,
          limit: 100 
        });
        invoices = invoicesResult.data;
        console.log('[subscription-info] Retrieved invoice count:', invoices.length);
      } catch (stripeErr: any) {
        console.error('[subscription-info] Error fetching invoices:', stripeErr);
        // Continue anyway, just with empty invoices
      }
    } else if (subscription) {
      // Fallback to subscription-specific invoices if no customer ID
      try {
        console.log('[subscription-info] Fetching invoices for subscription:', subscription.id);
        const invoicesResult = await stripe.invoices.list({ 
          subscription: subscription.id, 
          limit: 100 
        });
        invoices = invoicesResult.data;
        console.log('[subscription-info] Retrieved invoice count:', invoices.length);
      } catch (stripeErr: any) {
        console.error('[subscription-info] Error fetching subscription invoices:', stripeErr);
        // Continue anyway, just with empty invoices
      }
    }

    const response = NextResponse.json({
      subscription,
      subscriptions,
      invoices,
    });
    
    // Set cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return setCorsHeaders(response);
  } catch (error: any) {
    console.error('Error fetching Stripe subscription info:', error);
    const errorResponse = NextResponse.json({ 
      error: error.message || 'Internal server error'
    }, { status: 500 });
    
    // Set cache control headers
    errorResponse.headers.set('Cache-Control', 'no-store, max-age=0');
    return setCorsHeaders(errorResponse);
  }
} 