import { loadStripe } from '@stripe/stripe-js';
import Stripe from 'stripe';

console.log('[DEBUG] STRIPE_SECRET_KEY at module load:', process.env.STRIPE_SECRET_KEY);

// Helper function to ensure we have the secret key
const getStripeSecretKey = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('Missing STRIPE_SECRET_KEY environment variable');
    // Return a placeholder that will fail gracefully in dev
    return 'sk_test_placeholder';
  }
  return key;
};

// Initialize Stripe with secret key on server-side
let stripeInstance: Stripe | null = null;

// Create a function to get or create the Stripe instance
export const getStripeInstance = (): Stripe => {
  if (!stripeInstance && typeof process !== 'undefined') {
    console.log('STRIPE_SECRET_KEY:', process.env.STRIPE_SECRET_KEY);
    stripeInstance = new Stripe(getStripeSecretKey(), {
      apiVersion: '2023-10-16' as any, // Using type assertion for now until we update types
    });
  }
  
  if (!stripeInstance) {
    throw new Error('Stripe could not be initialized');
  }
  
  return stripeInstance;
};

// For backwards compatibility, export 'stripe' as null and warn if accessed
export const stripe = null;

// Initialize Stripe.js for client-side
let stripePromise: Promise<any> | null = null;

export const getStripe = () => {
  if (!stripePromise && typeof window !== 'undefined') {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (publishableKey) {
      stripePromise = loadStripe(publishableKey);
      console.log('Stripe initialized successfully on client side');
    } else {
      console.warn('Stripe publishable key not found in environment variables');
    }
  }
  return stripePromise;
};

// Define subscription plans
export const PLANS = {
  BASIC: {
    id: 'basic',
    name: 'Basic',
    price: 9.99,
    features: [
      'Create up to 5 service listings',
      'Access to SwapFeed',
      'Basic user profile'
    ],
    stripePriceId: {
      monthly: process.env.STRIPE_PRICE_BASIC_MONTHLY || 'basic',
      annual: process.env.STRIPE_PRICE_BASIC_ANNUAL || 'basicannual',
    }
  },
  PRO: {
    id: 'pro',
    name: 'Professional',
    price: 19.99,
    features: [
      'Create up to 15 service listings',
      'Access to SwapFeed',
      'Enhanced user profile with analytics',
      'Priority in search results'
    ],
    stripePriceId: {
      monthly: process.env.STRIPE_PRICE_PRO_MONTHLY || 'pro',
      annual: process.env.STRIPE_PRICE_PRO_ANNUAL || 'proannual',
    }
  },
  BUSINESS: {
    id: 'business',
    name: 'Business',
    price: 39.99,
    features: [
      'Unlimited service listings',
      'Access to SwapFeed',
      'Full user profile with advanced analytics',
      'Top placement in search results',
      'White-glove customer support'
    ],
    stripePriceId: {
      monthly: process.env.STRIPE_PRICE_BUSINESS_MONTHLY || 'business',
      annual: process.env.STRIPE_PRICE_BUSINESS_ANNUAL || 'businessannual',
    }
  },
  VERIFICATION: {
    id: 'verification',
    name: 'Verification Badge',
    price: 5.00,
    features: [
      'Verified badge on your profile',
      'Increased trust with other users',
      'Priority in search results'
    ],
    stripePriceId: {
      monthly: process.env.STRIPE_PRICE_VERIFICATION_MONTHLY || 'verification',
      annual: process.env.STRIPE_PRICE_VERIFICATION_ANNUAL || 'verificationannual',
    }
  }
};

// Types
export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  stripePriceId: {
    monthly: string;
    annual: string;
  };
}

export interface SubscriptionData {
  id: string;
  customerId: string;
  status: string;
  priceId: string;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  planId: string;  // 'basic', 'pro', 'business'
  interval: string; // 'month' or 'year'
}

// Helper to determine if subscription is active
export function isSubscriptionActive(subscription: SubscriptionData | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'active' || subscription.status === 'trialing';
}

// Helper to determine if subscription is canceled but still usable
export function isSubscriptionGracePeriod(subscription: SubscriptionData | null): boolean {
  if (!subscription) return false;
  
  // Check cancel_at_period_end flag directly
  return (subscription.cancelAtPeriodEnd === true) && 
         // Also make sure it's an active subscription
         (subscription.status === 'active' || subscription.status === 'trialing');
}

// Helper to get plan details by ID
export function getPlanById(planId: string): SubscriptionPlan {
  return Object.values(PLANS).find(plan => plan.id === planId) || PLANS.BASIC;
} 