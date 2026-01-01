import { NextRequest, NextResponse } from 'next/server';
import { getStripeInstance } from '@/app/lib/stripe';
import { updateUserSubscription } from '@/app/lib/subscriptions';
import { headers } from 'next/headers';
import { Readable } from 'stream';

// Helper to convert ReadableStream to Buffer
async function buffer(readable: ReadableStream) {
  const chunks = [];
  const reader = readable.getReader();
  
  while (true) {
    const { done, value } = await reader.read();
    
    if (done) {
      break;
    }
    
    chunks.push(typeof value === 'string' ? Buffer.from(value) : value);
  }
  
  return Buffer.concat(chunks);
}

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    const stripe = getStripeInstance();
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get('stripe-signature') || '';
    
    if (!webhookSecret) {
      console.warn('Stripe webhook secret is not set');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    
    // Verify the webhook signature
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    
    console.log(`[WEBHOOK] Received event: ${event.type}`);
    
    // Handle the event based on type
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('[WEBHOOK] Processing checkout.session.completed event');
        const session = event.data.object;
        
        // Get subscription ID from the session
        const subscriptionId = session.subscription;
        if (!subscriptionId) {
          console.error('[WEBHOOK] No subscription ID found in completed checkout session');
          return NextResponse.json({ error: 'No subscription ID in checkout session' }, { status: 400 });
        }
        
        // Get subscription details from Stripe
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId as string);
          console.log('[WEBHOOK] Retrieved subscription from checkout:', {
            id: subscription.id,
            status: subscription.status,
            customer: subscription.customer
          });
          
          // Get userId from metadata
          let userId = subscription.metadata?.userId || session.metadata?.userId;
          
          // If userId is missing, try to get it from customer metadata
          if (!userId) {
            const customerId = typeof subscription.customer === 'string' ? 
              subscription.customer : subscription.customer.id;
            
            const customer = await stripe.customers.retrieve(customerId);
            if (customer && typeof customer === 'object' && 'metadata' in customer) {
              userId = customer.metadata.userId;
            }
          }
          
          if (!userId) {
            console.error('[WEBHOOK] Unable to find userId for subscription', subscription.id);
            return NextResponse.json({ error: 'No userId found for subscription' }, { status: 400 });
          }
          
          // Get plan ID from metadata or from the first price's product
          let planId = subscription.metadata?.planId || session.metadata?.planId;
          
          if (!planId) {
            const priceId = subscription.items.data[0]?.price?.id;
            // Map Stripe price/product IDs to planId if needed
            const priceToPlanId: Record<string, string> = {
              [process.env.STRIPE_PRICE_VERIFICATION_MONTHLY || '']: 'verification',
              [process.env.STRIPE_PRICE_VERIFICATION_ANNUAL || '']: 'verification',
              [process.env.STRIPE_PRICE_BASIC_MONTHLY || '']: 'basic',
              [process.env.STRIPE_PRICE_BASIC_ANNUAL || '']: 'basic',
              [process.env.STRIPE_PRICE_PRO_MONTHLY || '']: 'pro',
              [process.env.STRIPE_PRICE_PRO_ANNUAL || '']: 'pro',
              [process.env.STRIPE_PRICE_BUSINESS_MONTHLY || '']: 'business',
              [process.env.STRIPE_PRICE_BUSINESS_ANNUAL || '']: 'business',
            };
            planId = priceId ? priceToPlanId[priceId] : 'basic';
          }
          
          // Save subscription to Firestore
          const { db } = await import('@/app/lib/firebase');
          const { doc, setDoc, collection } = await import('firebase/firestore');
          
          // For verification badges, update user document
          if (planId === 'verification') {
            console.log('[WEBHOOK] Updating verification badge for user', userId);
            const userRef = doc(db, 'users', userId);
            await setDoc(userRef, {
              verificationBadge: {
                active: subscription.status === 'active' || subscription.status === 'trialing',
                subscriptionId: subscription.id,
                priceId: subscription.items.data[0]?.price?.id,
                interval: subscription.items.data[0]?.price?.recurring?.interval || null,
                currentPeriodEnd: (subscription as any).current_period_end ? new Date((subscription as any).current_period_end * 1000).toISOString() : null,
                status: subscription.status,
              }
            }, { merge: true });
          } else {
            // Create/update subscription document using Stripe's subscription ID in the nested structure
            console.log(`[WEBHOOK] Creating subscription document in Firestore at subscriptions/${userId}/userSubscriptions/${subscription.id}`);
            
            // Use the nested structure: subscriptions > userId > userSubscriptions > subscriptionId
            const userSubscriptionsCollection = collection(db, 'subscriptions', userId, 'userSubscriptions');
            const subscriptionRef = doc(userSubscriptionsCollection, subscription.id);
            
            // Extract and convert data
            const subscriptionData = {
              id: subscription.id,
              userId,
              planId,
              customerId: typeof subscription.customer === 'string' ? 
                subscription.customer : subscription.customer.id,
              status: subscription.status,
              currentPeriodStart: (subscription as any).current_period_start,
              currentPeriodEnd: (subscription as any).current_period_end,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              priceId: subscription.items.data[0]?.price?.id,
              interval: subscription.items.data[0]?.price?.recurring?.interval,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            await setDoc(subscriptionRef, subscriptionData);
            console.log(`[WEBHOOK] Successfully created subscription in Firestore: ${subscription.id}`);
          }
        } catch (error) {
          console.error('[WEBHOOK] Error processing checkout completion:', error);
          // Continue anyway to avoid repeating webhook events
        }
        break;
      }
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        // Debug: log the full subscription object
        console.log('Stripe subscription object:', JSON.stringify(subscription, null, 2));
        let userId = subscription.metadata?.userId;
        let planId = subscription.metadata?.planId;
        const status = subscription.status;
        const priceId = subscription.items.data[0]?.price?.id;
        const productId = subscription.items.data[0]?.price?.product;
        // Map Stripe price/product IDs to planId if needed
        const priceToPlanId: Record<string, string> = {
          [process.env.STRIPE_PRICE_VERIFICATION_MONTHLY || ''] : 'verification',
          [process.env.STRIPE_PRICE_VERIFICATION_ANNUAL || ''] : 'verification',
          [process.env.STRIPE_PRICE_BASIC_MONTHLY || ''] : 'basic',
          [process.env.STRIPE_PRICE_BASIC_ANNUAL || ''] : 'basic',
          [process.env.STRIPE_PRICE_PRO_MONTHLY || ''] : 'pro',
          [process.env.STRIPE_PRICE_PRO_ANNUAL || ''] : 'pro',
          [process.env.STRIPE_PRICE_BUSINESS_MONTHLY || ''] : 'business',
          [process.env.STRIPE_PRICE_BUSINESS_ANNUAL || ''] : 'business',
        };
        if (priceId && priceToPlanId[priceId]) {
          planId = priceToPlanId[priceId];
        }
        // PATCH: If userId is missing, try to get it from the Stripe customer metadata
        if (!userId && subscription.customer) {
          try {
            const stripe = getStripeInstance();
            const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
            const customer = await stripe.customers.retrieve(customerId);
            if (
              customer &&
              typeof customer === 'object' &&
              'metadata' in customer &&
              customer.metadata &&
              (customer.metadata as any).userId
            ) {
              userId = (customer.metadata as any).userId;
            }
          } catch (err) {
            console.error('Failed to fetch Stripe customer for userId fallback:', err);
          }
        }
        if (!userId) {
          console.error('No userId found for subscription', subscription.id);
          return NextResponse.json({ error: 'No userId found' }, { status: 400 });
        }
        console.log('[WEBHOOK] planId:', planId, 'priceId:', priceId);
        // Always overwrite the Firestore document with the latest Stripe data
        const { db } = await import('@/app/lib/firebase');
        const { doc, setDoc, updateDoc, collection } = await import('firebase/firestore');
        console.log('[STRIPE WEBHOOK] Handler invoked at', new Date().toISOString());
        if (planId === 'verification') {
          // For verification badge, update a separate field on the user document
          const userDocRef = doc(db, 'users', userId);
          const verificationBadge = {
            active: status === 'active' || status === 'trialing',
            subscriptionId: subscription.id,
            priceId,
            interval: subscription.items.data[0]?.price?.recurring?.interval || null,
            currentPeriodEnd: (subscription as any)['current_period_end'] ? new Date((subscription as any)['current_period_end'] * 1000).toISOString() : null,
            status,
          };
          console.log('[WEBHOOK][BADGE] Updating verificationBadge:', {
            eventType: event.type,
            userId,
            planId,
            status,
            verificationBadge,
          });
          await updateDoc(userDocRef, {
            verificationBadge
          });
          console.log(`[WEBHOOK] Updated verificationBadge field for user ${userId}`);
          // EARLY RETURN: do not write to subscriptions collection
          return NextResponse.json({ received: true });
        }
        // Only update the subscriptions collection for main plans
        console.log('[STRIPE WEBHOOK] About to write to subscriptions:', { planId, subscriptionId: subscription.id });
        
        // Use the nested structure: subscriptions > userId > userSubscriptions > subscriptionId 
        const userSubscriptionsCollection = collection(db, 'subscriptions', userId, 'userSubscriptions');
        const subIdDocRef = doc(userSubscriptionsCollection, subscription.id);
        
        await setDoc(subIdDocRef, {
          ...subscription,
          userId,
          planId,
        });
        console.log(`[WEBHOOK] Updated subscription in Firestore at subscriptions/${userId}/userSubscriptions/${subscription.id}`);
        break;
      }
      
      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object;
        const deletedUserId = deletedSubscription.metadata?.userId;
        const deletedPlanId = deletedSubscription.metadata?.planId;
        
        if (deletedUserId && deletedPlanId) {
          // Update the subscription status to canceled in Firestore
          await updateUserSubscription(deletedUserId, deletedPlanId, {
            status: 'canceled',
            cancelAtPeriodEnd: false,
          });
          
          console.log(`Marked subscription as canceled for user ${deletedUserId}, plan ${deletedPlanId}`);
        }
        break;
      
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        // Debug: log the full invoice object
        console.log('Stripe invoice object:', JSON.stringify(invoice, null, 2));
        // Save the entire invoice object to billingHistory
        try {
          const { db } = await import('@/app/lib/firebase');
          const { collection, addDoc, doc, getDoc } = await import('firebase/firestore');
          const subscriptionId = (invoice as any).subscription;
          
          // Need to find the userId for this subscription
          let userId = null;
          
          // Try to get userId from the customer metadata
          if (invoice.customer) {
            const stripe = getStripeInstance();
            const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer.id;
            const customer = await stripe.customers.retrieve(customerId);
            if (customer && typeof customer === 'object' && 'metadata' in customer && customer.metadata.userId) {
              userId = customer.metadata.userId;
            }
          }
          
          // If we found the userId, store in the nested structure
          if (userId) {
            console.log(`[WEBHOOK] Adding invoice to billing history at subscriptions/${userId}/userSubscriptions/${subscriptionId}/billingHistory`);
            const billingHistoryRef = collection(db, 'subscriptions', userId, 'userSubscriptions', subscriptionId, 'billingHistory');
            await addDoc(billingHistoryRef, invoice);
            console.log(`[WEBHOOK] Added full Stripe invoice to billingHistory for subscription ${subscriptionId}`);
          } else {
            console.error(`[WEBHOOK] Could not find userId for subscription ${subscriptionId}, cannot store invoice`);
          }
        } catch (err) {
          console.error('Failed to write billing history:', err);
        }
        break;
      }
      
      case 'invoice.payment_failed':
        // Handle failed payments
        const failedInvoice = event.data.object;
        const failedSubscriptionId = (failedInvoice as any).subscription;
        const failedCustomerId = failedInvoice.customer;
        
        console.log(`Payment failed for subscription ${failedSubscriptionId}, customer ${failedCustomerId}`);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
    
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 400 }
    );
  }
}

// Disable body parsing to receive raw body for Stripe webhook verification
export const config = {
  api: {
    bodyParser: false,
  },
}; 