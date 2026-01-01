import { db } from './firebaseCompat';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { createNotification } from './notifications';

export async function createSwapRequestNotification(swapId: string, providerId: string, receiverId: string, serviceTitle: string) {
  try {
    // Get provider's name
    const providerDoc = await getDoc(doc(db, 'users', providerId));
    const providerName = providerDoc.data()?.displayName || 'User';

    await createNotification({
      userId: receiverId,
      type: 'swap_request',
      senderId: providerId,
      senderName: providerName,
      serviceTitle,
      swapId
    });
  } catch (error) {
    console.error('Error creating swap request notification:', error);
  }
}

export async function createSwapAcceptNotification(swapId: string, providerId: string, receiverId: string, serviceTitle: string) {
  try {
    // Get receiver's name
    const receiverDoc = await getDoc(doc(db, 'users', receiverId));
    const receiverName = receiverDoc.data()?.displayName || 'User';

    await createNotification({
      userId: providerId,
      type: 'swap_accept',
      senderId: receiverId,
      senderName: receiverName,
      serviceTitle,
      swapId
    });
  } catch (error) {
    console.error('Error creating swap accept notification:', error);
  }
}

export async function createSwapRejectNotification(swapId: string, providerId: string, receiverId: string, serviceTitle: string) {
  try {
    // Get receiver's name
    const receiverDoc = await getDoc(doc(db, 'users', receiverId));
    const receiverName = receiverDoc.data()?.displayName || 'User';

    await createNotification({
      userId: providerId,
      type: 'swap_reject',
      senderId: receiverId,
      senderName: receiverName,
      serviceTitle,
      swapId
    });
  } catch (error) {
    console.error('Error creating swap reject notification:', error);
  }
}

export async function createMessageNotification(conversationId: string, senderId: string, receiverId: string, message: string) {
  try {
    // Get sender's name
    const senderDoc = await getDoc(doc(db, 'users', senderId));
    const senderName = senderDoc.data()?.displayName || 'User';

    await createNotification({
      userId: receiverId,
      type: 'message',
      senderId,
      senderName,
      message,
      conversationId
    });
  } catch (error) {
    console.error('Error creating message notification:', error);
  }
} 