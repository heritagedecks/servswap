// backfill-stripe-customer-ids.js

require('dotenv').config();
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const Stripe = require('stripe');

// Initialize Firebase Admin
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}
const db = getFirestore();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

async function backfill() {
  const usersSnapshot = await db.collection('users').get();
  let updated = 0;
  let skipped = 0;

  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    if (user.stripeCustomerId) {
      skipped++;
      continue;
    }
    if (!user.email) {
      console.log(`User ${userDoc.id} has no email, skipping.`);
      continue;
    }
    // Find Stripe customer by email
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1,
    });
    if (customers.data.length > 0) {
      const customer = customers.data[0];
      await userDoc.ref.set({ stripeCustomerId: customer.id }, { merge: true });
      console.log(`Updated user ${userDoc.id} with Stripe customer ID ${customer.id}`);
      updated++;
    } else {
      console.log(`No Stripe customer found for user ${userDoc.id} (${user.email})`);
    }
  }
  console.log(`Backfill complete. Updated: ${updated}, Skipped: ${skipped}`);
}

backfill().catch(console.error); 