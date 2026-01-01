import { db } from './firebaseCompat';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface NotificationData {
  userId: string;
  type: 'swap_request' | 'swap_accept' | 'swap_reject' | 'message' | 'comment' | 'like' | 'follow' | 'mention';
  senderId: string;
  senderName: string;
  message?: string;
  serviceTitle?: string;
  swapId?: string;
  conversationId?: string;
  postId?: string;
  comment?: string;
  link?: string;
  contentContext?: string; // For mentions, provides context where the mention occurred
}

export async function createNotification(data: NotificationData) {
  try {
    console.log('Creating notification:', data);
    const docRef = await addDoc(collection(db, 'notifications'), {
      ...data,
      createdAt: serverTimestamp(),
      isRead: false
    });
    console.log('Notification created with ID:', docRef.id);
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}

// Helper function to create mention notifications
export async function createMentionNotifications(
  text: string, 
  postId: string,
  senderId: string,
  senderName: string,
  contextType: 'post' | 'comment' | 'reply' = 'post',
  parentPostId?: string // Required for comments/replies
) {
  try {
    // Extract mentions from the text
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: { id: string, name: string }[] = [];
    
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push({
        id: match[1],
        name: match[2]
      });
    }
    
    if (mentions.length === 0) return;
    
    // Create appropriate context description
    let contextText = '';
    let link = '';
    
    switch (contextType) {
      case 'post':
        contextText = 'a post';
        link = `/profile/${senderId}?postId=${postId}`;
        break;
      case 'comment':
        contextText = 'a comment';
        link = `/profile/${senderId}?postId=${parentPostId || postId}`;
        break;
      case 'reply':
        contextText = 'a reply';
        link = `/profile/${senderId}?postId=${parentPostId || postId}`;
        break;
    }
    
    // Create notification for each mentioned user
    const notificationPromises = mentions.map(mention => {
      return createNotification({
        userId: mention.id,
        type: 'mention',
        senderId,
        senderName,
        message: `${senderName} mentioned you in ${contextText}`,
        postId: contextType === 'post' ? postId : parentPostId || postId,
        link,
        contentContext: contextType
      });
    });
    
    await Promise.all(notificationPromises);
    
  } catch (error) {
    console.error('Error creating mention notifications:', error);
  }
} 