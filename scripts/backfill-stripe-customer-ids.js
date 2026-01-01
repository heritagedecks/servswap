// Usage: node scripts/backfill-stripe-customer-ids.js <path-to-service-account-key.json>

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Missing STRIPE_SECRET_KEY in environment variables.');
  process.exit(1);
}

if (process.argv.length < 3) {
  console.error('Usage: node scripts/backfill-stripe-customer-ids.js <path-to-service-account-key.json>');
  process.exit(1);
}

const serviceAccountPath = process.argv[2];
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account key file not found:', serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });

async function backfill() {
  const usersSnapshot = await db.collection('users').get();
  let updated = 0;
  let skipped = 0;
  for (const userDoc of usersSnapshot.docs) {
    const user = userDoc.data();
    const userId = userDoc.id;
    const email = user.email;
    const currentId = user.stripeCustomerId;
    if (currentId && typeof currentId === 'string' && currentId.startsWith('cus_')) {
      console.log(`User ${userId} already has valid stripeCustomerId: ${currentId}`);
      skipped++;
      continue;
    }
    if (!email) {
      console.log(`User ${userId} has no email, skipping.`);
      skipped++;
      continue;
    }
    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length > 0) {
      const customer = customers.data[0];
      await userDoc.ref.set({ stripeCustomerId: customer.id }, { merge: true });
      console.log(`Updated user ${userId} with Stripe customer ID ${customer.id}`);
      updated++;
    } else {
      console.log(`No Stripe customer found for user ${userId} (${email})`);
      skipped++;
    }
  }
  console.log(`Backfill complete. Updated: ${updated}, Skipped: ${skipped}`);
}

backfill().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); }); 