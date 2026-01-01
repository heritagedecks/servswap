import { db } from './firebaseCompat';
import { getStripeInstance, SubscriptionData, isSubscriptionActive } from './stripe';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Utility: Get all subscriptions for a Stripe customerId
export async function getSubscriptionsByCustomerId(stripeCustomerId: string): Promise<SubscriptionData[]> {
  try {
    const subsQuery = query(collection(db, 'subscriptions'), where('customerId', '==', stripeCustomerId));
    const subsSnap = await getDocs(subsQuery);
    return subsSnap.docs.map(doc => doc.data() as SubscriptionData);
  } catch (error) {
    console.error('Error getting subscriptions by customerId:', error);
    return [];
  }
}

// Get all subscriptions for a user (by their userId, looks up stripeCustomerId)
export async function getAllUserSubscriptions(userId: string): Promise<SubscriptionData[]> {
  try {
    // Fetch user doc to get stripeCustomerId
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.exists() ? userDoc.data() : null;
    const stripeCustomerId = userData?.stripeCustomerId;
    
    let subscriptions: SubscriptionData[] = [];
    
    // If we have a stripeCustomerId, get subscriptions by that ID
    if (stripeCustomerId) {
      try {
        const subsQuery = query(collection(db, 'subscriptions'), where('customerId', '==', stripeCustomerId));
        const subsSnap = await getDocs(subsQuery);
        subscriptions = subsSnap.docs.map(doc => doc.data() as SubscriptionData);
        
        if (subscriptions.length > 0) {
          console.log(`Found ${subscriptions.length} subscriptions by stripeCustomerId`);
          return subscriptions;
        }
      } catch (error) {
        console.error('Error querying subscriptions by customerId:', error);
      }
    }
    
    // If no subscriptions were found by stripeCustomerId, check for a direct document with userId
    try {
      // Check if there's a document with the userId as the document ID
      const directSubRef = doc(db, 'subscriptions', userId);
      const directSubDoc = await getDoc(directSubRef);
      
      if (directSubDoc.exists()) {
        const directSub = directSubDoc.data() as SubscriptionData;
        if (directSub) {
          console.log('Found subscription document using userId as document ID');
          return [directSub];
        }
      }
    } catch (error) {
      console.error('Error getting subscription by userId as document ID:', error);
    }
    
    // If still no subscriptions, try the nested structure: subscriptions > userId > userSubscriptions
    try {
      console.log('Checking for subscriptions in nested structure:', userId);
      const nestedSubsCollection = collection(db, 'subscriptions', userId, 'userSubscriptions');
      const nestedSubsSnap = await getDocs(nestedSubsCollection);
      
      if (!nestedSubsSnap.empty) {
        const nestedSubs = nestedSubsSnap.docs.map(doc => doc.data() as SubscriptionData);
        console.log(`Found ${nestedSubs.length} subscriptions in nested structure`);
        return nestedSubs;
      }
    } catch (error) {
      console.error('Error getting subscriptions from nested structure:', error);
    }
    
    // If we got here, no subscriptions were found by any method
    console.warn('No subscriptions found for user', userId);
    return [];
  } catch (error) {
    console.error('Error getting all user subscriptions:', error);
    return [];
  }
}

// Get a specific subscription for a user by planId (using customerId)
export async function getUserSubscription(userId: string, planId: string): Promise<SubscriptionData | null> {
  try {
    // Fetch user doc to get stripeCustomerId
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.exists() ? userDoc.data() : null;
    const stripeCustomerId = userData?.stripeCustomerId;
    if (!stripeCustomerId) {
      console.warn('No stripeCustomerId found for user', userId);
      return null;
    }
    const subs = await getSubscriptionsByCustomerId(stripeCustomerId);
    return subs.find(sub => sub.planId === planId) || null;
  } catch (error) {
    console.error('Error getting user subscription:', error);
    return null;
  }
}

// Create or update a specific subscription for a user and planId (kept for compatibility, but still uses userId/planId as doc ID)
export async function updateUserSubscription(
  userId: string,
  planId: string,
  subscriptionData: Partial<SubscriptionData>
): Promise<void> {
  try {
    if (planId === 'verification') {
      // Write to a separate field on the user document
      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        verificationBadge: {
          ...subscriptionData,
          planId: 'verification',
        },
      });
      return;
    }
    const subscriptionDocRef = doc(db, 'subscriptions', `${userId}_${planId}`);
    const subscriptionDoc = await getDoc(subscriptionDocRef);
    // LOGGING: Firestore write to subscriptions collection
    console.log('[FIRESTORE WRITE] Writing to subscriptions collection', {
      file: 'subscriptions.ts',
      function: 'updateUserSubscription',
      userId,
      planId,
      data: subscriptionData,
      stack: new Error().stack,
    });
    if (subscriptionDoc.exists()) {
      await updateDoc(subscriptionDocRef, subscriptionData);
    } else {
      await setDoc(subscriptionDocRef, { ...subscriptionData, userId, planId });
    }
  } catch (error) {
    console.error('Error updating user subscription:', error);
    throw error;
  }
}

// Cancel subscription at period end (by userId/planId)
export async function cancelSubscription(userId: string, planId: string): Promise<boolean> {
  try {
    const stripe = getStripeInstance();
    const subscription = await getUserSubscription(userId, planId);
    if (!subscription || !isSubscriptionActive(subscription)) {
      throw new Error('No active subscription found');
    }
    // Update with Stripe
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });
    // Update in Firestore
    await updateUserSubscription(userId, planId, {
      cancelAtPeriodEnd: true,
    });
    return true;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return false;
  }
}

// Resume a subscription that was previously canceled
export async function resumeSubscription(userId: string, planId: string): Promise<boolean> {
  try {
    const stripe = getStripeInstance();
    const subscription = await getUserSubscription(userId, planId);
    if (!subscription || !isSubscriptionActive(subscription)) {
      throw new Error('No active subscription found');
    }
    if (!subscription.cancelAtPeriodEnd) {
      throw new Error('Subscription is not scheduled for cancellation');
    }
    // Update with Stripe
    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
    });
    // Update in Firestore
    await updateUserSubscription(userId, planId, {
      cancelAtPeriodEnd: false,
    });
    return true;
  } catch (error) {
    console.error('Error resuming subscription:', error);
    return false;
  }
}

// Change subscription plan
export async function changeSubscriptionPlan(
  userId: string,
  planId: string,
  newPriceId: string,
  newPlanId: string,
  interval: 'month' | 'year'
): Promise<boolean> {
  try {
    const stripe = getStripeInstance();
    const subscription = await getUserSubscription(userId, planId);
    if (!subscription || !isSubscriptionActive(subscription)) {
      throw new Error('No active subscription found');
    }
    // Update with Stripe
    await stripe.subscriptions.update(subscription.id, {
      items: [
        {
          id: subscription.id, // This should be the subscription item ID
          price: newPriceId,
        },
      ],
    });
    // Update in Firestore
    await updateUserSubscription(userId, planId, {
      priceId: newPriceId,
      planId: newPlanId,
      interval: interval,
    });
    return true;
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    return false;
  }
}

// Delete a subscription completely (use with caution)
export async function deleteSubscription(userId: string, planId: string): Promise<boolean> {
  try {
    const stripe = getStripeInstance();
    const subscription = await getUserSubscription(userId, planId);
    if (subscription) {
      // Delete subscription in Stripe if it exists
      if (subscription.id) {
        await stripe.subscriptions.cancel(subscription.id);
      }
      // Delete from Firestore
      const subscriptionDocRef = doc(db, 'subscriptions', `${userId}_${planId}`);
      // LOGGING: Firestore delete from subscriptions collection
      console.log('[FIRESTORE DELETE] Deleting from subscriptions collection', {
        file: 'subscriptions.ts',
        function: 'deleteSubscription',
        userId,
        planId,
        stack: new Error().stack,
      });
      await deleteDoc(subscriptionDocRef);
    }
    return true;
  } catch (error) {
    console.error('Error deleting subscription:', error);
    return false;
  }
}

// Update or merge a single subscription doc per user (legacy, not used in new logic)
export async function updateUserSubscriptionSingleDoc(
  userId: string,
  subscriptionData: Partial<SubscriptionData> & { planId?: string; planId2?: string; interval?: string; interval2?: string }
): Promise<void> {
  try {
    const subscriptionDocRef = doc(db, 'subscriptions', userId);
    const subscriptionDoc = await getDoc(subscriptionDocRef);
    // LOGGING: Firestore write to subscriptions collection (single doc)
    console.log('[FIRESTORE WRITE] Writing to subscriptions collection (single doc)', {
      file: 'subscriptions.ts',
      function: 'updateUserSubscriptionSingleDoc',
      userId,
      data: subscriptionData,
      stack: new Error().stack,
    });
    if (subscriptionDoc.exists()) {
      await updateDoc(subscriptionDocRef, subscriptionData);
    } else {
      await setDoc(subscriptionDocRef, { ...subscriptionData, userId });
    }
  } catch (error) {
    console.error('Error updating single user subscription doc:', error);
    throw error;
  }
}

// Utility: Get the verification badge status for a user
export async function getUserVerificationBadge(userId: string): Promise<any | null> {
  try {
    const userDocRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.verificationBadge || null;
    }
    return null;
  } catch (error) {
    console.error('Error getting user verification badge:', error);
    return null;
  }
} 