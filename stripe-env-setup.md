# Stripe Environment Variables Setup

Add the following variables to your `.env.local` file:

```env
# Stripe API Keys - Replace with your actual keys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Product/Price IDs - Basic Plan
# Create these products and prices in your Stripe dashboard
STRIPE_PRICE_BASIC_MONTHLY=price_...
STRIPE_PRICE_BASIC_ANNUAL=price_...

# Stripe Product/Price IDs - Pro Plan
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...

# Stripe Product/Price IDs - Business Plan
STRIPE_PRICE_BUSINESS_MONTHLY=price_...
STRIPE_PRICE_BUSINESS_ANNUAL=price_...
```

## Setup Instructions

### 1. Create a Stripe Account

If you don't already have one, sign up at [stripe.com](https://stripe.com).

### 2. Get API Keys

In your Stripe Dashboard, go to Developers > API keys to find your Secret and Publishable keys.

### 3. Create Products and Prices

For each subscription tier (Basic, Pro, Business):

1. Go to Products > Add Product
2. Create a product for each tier
3. Add `planId` metadata to each product (values: `basic`, `pro`, `business`)
4. For each product, create two prices:
   - Monthly recurring price
   - Annual recurring price (with discount)
5. Copy the price IDs and paste them into your env file

### 4. Set Up Webhooks

1. Go to Developers > Webhooks
2. Add a new endpoint with URL: `https://yourdomain.com/api/webhooks/stripe`
3. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
4. Get the signing secret and add it to your env file

### 5. Test With Stripe CLI

For local testing, use the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward webhook events to your local environment:

```
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### 6. Test the Integration

Use Stripe test cards to test the subscription flow:

- Successful payment: `4242 4242 4242 4242`
- Failed payment: `4000 0000 0000 0002` 