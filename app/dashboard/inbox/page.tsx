'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { db, realtimeDb } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, Timestamp, getDoc, addDoc, serverTimestamp, deleteDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbServerTimestamp, DatabaseReference, Unsubscribe, get } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import Link from 'next/link';
import { createSwapAcceptNotification, createSwapRejectNotification } from '@/app/lib/swapNotifications';
import { createNotification } from '@/app/lib/notifications';
import { app } from '@/app/lib/firebase';
import { CheckCircle } from 'lucide-react';

// Define the swap type
interface Swap {
  id: string;
  providerId: string;
  providerName: string;
  providerService: string;
  providerServiceId: string;
  receiverId: string;
  receiverName: string;
  receiverService: string;
  receiverServiceId: string;
  status: 'pending' | 'accepted' | 'completed' | 'declined' | 'cancelled';
  message: string;
  createdAt: Date;
  updatedAt: Date;
  read: boolean;
  providerMarkedComplete?: boolean;
  receiverMarkedComplete?: boolean;
  messages?: Message[];
  providerPhoto?: string;
  receiverPhoto?: string;
}

// Define the Message type
interface Message {
  id?: string;
  swapId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'voice';
  read?: boolean;
}

// Status indicator component
const StatusIndicator = ({ status }: { status: string }) => {
  const statusColors: { [key: string]: string } = {
    online: 'bg-green-500',
    offline: 'bg-gray-400',
    away: 'bg-yellow-500',
  };

  const color = statusColors[status] || 'bg-gray-400';

  return (
    <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white ${color}`}></span>
  );
};

// Add a MessagesContainer component that auto-scrolls to the latest message
const MessagesContainer = ({ messages, userId }: { messages: Message[], userId: string | undefined }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  
  // Track if user has manually scrolled up
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Consider user as scrolled up if they're not at the bottom (with a small buffer)
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setHasUserScrolled(!isAtBottom);
    }
  };

  // Auto-scroll to bottom when messages update, but only if user hasn't scrolled up
  useEffect(() => {
    if (messagesEndRef.current && !hasUserScrolled) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, hasUserScrolled]);

  return (
    <div 
      className="overflow-y-auto flex-1 w-full overflow-x-hidden"
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="space-y-4 w-full px-4 pb-4">
      {messages.length > 0 ? (
          <>
          {messages.map((message, index) => {
            const isCurrentUser = message.senderId === userId;
            return (
              <div
                key={message.id || `message-${index}`}
                className={`flex w-full ${isCurrentUser ? 'justify-end' : 'justify-start'} relative group`}
              >
                <div
                    className={`max-w-[70%] px-4 py-2 rounded-lg break-words ${
                    isCurrentUser
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                      : 'bg-white border shadow-sm'
                  }`}
                >
                  {message.text && <p className="text-sm overflow-hidden break-words">{message.text}</p>}
                  
                  {message.attachmentUrl && message.attachmentType === 'image' && (
                    <div className="mt-2 rounded-md overflow-hidden">
                      <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
                        <Image 
                          src={message.attachmentUrl} 
                          alt="Attached image" 
                          width={200} 
                          height={150} 
                          className="w-full object-contain rounded-md" 
                          style={{ maxHeight: '200px' }}
                        />
                      </a>
                    </div>
                  )}
                  
                  {message.attachmentUrl && message.attachmentType === 'voice' && (
                    <div className="mt-2">
                      <audio controls className="w-full h-10">
                        <source src={message.attachmentUrl} type="audio/mpeg" />
                        Your browser does not support the audio element.
                      </audio>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center mt-1">
                    <p className={`text-xs ${isCurrentUser ? 'text-indigo-100' : 'text-gray-400'}`}>
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    
                    {/* Basic read indicator - could be enhanced with actual read receipts */}
                    {isCurrentUser && message.read !== undefined && (
                      <span className="ml-2">
                        {message.read ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-indigo-100" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-indigo-100 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center py-4 text-sm text-gray-500">
            No messages yet. Start the conversation!
        </div>
        )}
      </div>
    </div>
  );
};

// Add Message container component for connection messages
const ConnectionMessagesContainer = ({ messages, userId, onDeleteMessage }: { messages: any[], userId: string | undefined, onDeleteMessage: (message: any) => void }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  
  // Track if user has manually scrolled up
  const handleScroll = () => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      // Consider user as scrolled up if they're not at the bottom (with a small buffer)
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setHasUserScrolled(!isAtBottom);
    }
  };

  // Auto-scroll to bottom when messages update, but only if user hasn't scrolled up
  useEffect(() => {
    if (messagesEndRef.current && !hasUserScrolled) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, hasUserScrolled]);

  return (
    <div 
      className="overflow-y-auto flex-1 w-full"
      style={{ overflowX: "hidden" }}
      ref={containerRef}
      onScroll={handleScroll}
    >
      <div className="space-y-4 w-full px-4 pb-4">
        {messages.length > 0 ? (
          <>
            {messages.map((message, index) => {
              const isCurrentUser = message.senderId === userId;
              return (
                <div
                  key={message.id || `message-${index}`}
                  className={`flex w-full ${isCurrentUser ? 'justify-end' : 'justify-start'} relative group`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-2 rounded-lg break-words ${
                      isCurrentUser
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                        : 'bg-white border shadow-sm'
                    }`}
                  >
                    {message.text && <p className="text-sm overflow-hidden break-words">{message.text}</p>}
                    {message.attachmentUrl && message.attachmentType === 'image' && (
                      <div className="mt-2 rounded-md overflow-hidden">
                        <a href={message.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block">
                          <Image 
                            src={message.attachmentUrl} 
                            alt="Attached image" 
                            width={200} 
                            height={150} 
                            className="w-full object-contain rounded-md" 
                            style={{ maxHeight: '200px' }}
                          />
                        </a>
                      </div>
                    )}
                    {message.attachmentUrl && message.attachmentType === 'voice' && (
                      <div className="mt-2">
                        <audio controls className="w-full h-10">
                          <source src={message.attachmentUrl} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-1">
                      <p
                        className={`text-xs ${
                          isCurrentUser ? 'text-indigo-100' : 'text-gray-400'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      
                      {/* Read receipt indicator - only show for current user's messages */}
                      {isCurrentUser && message.read && (
                        <span className="ml-2">
                          {message.read && Object.keys(message.read).filter(id => id !== userId && message.read[id]).length > 0 ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-indigo-100" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-indigo-100 opacity-50" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Delete option for own messages */}
                  {isCurrentUser && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteMessage(message);
                      }}
                      className="absolute top-0 right-0 -mt-2 -mr-2 opacity-0 group-hover:opacity-100 bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <div className="text-center py-4 text-sm text-gray-500">
            No messages yet. Start the conversation!
          </div>
        )}
      </div>
    </div>
  );
};

// Add the VerificationBadge component
interface VerificationBadgeProps {
  userId: string;
  className?: string;
}
const VerificationBadge = ({ userId, className = '' }: VerificationBadgeProps) => {
  const [active, setActive] = useState(false);
  useEffect(() => {
    let mounted = true;
    async function fetchBadge() {
      if (!userId) return;
      try {
        const userDocRef = doc(db, 'users', userId);
        const userDocSnap = await getDoc(userDocRef);
        const badge = userDocSnap.exists() ? userDocSnap.data().verificationBadge : null;
        if (mounted) setActive(!!(badge && badge.active));
      } catch {
        if (mounted) setActive(false);
      }
    }
    fetchBadge();
    return () => { mounted = false; };
  }, [userId]);
  if (!active) return null;
  return <span aria-label="Verified" title="Verified"><CheckCircle className={`inline ml-1 text-blue-500 ${className}`} /></span>;
};

export default function InboxPage() {
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSwap, setSelectedSwap] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentType, setAttachmentType] = useState<'image' | 'voice' | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const swapRequested = searchParams?.get('swapRequested');
  const chatId = searchParams?.get('chat');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);

  // Add a messageContainerRef to scroll chat to bottom
  const swapMessageContainerRef = useRef<HTMLDivElement>(null);
  const connectionMessageContainerRef = useRef<HTMLDivElement>(null);

  // Add a messageInputRef to focus on input after sending
  const messageInputRef = useRef<HTMLInputElement>(null);

  // Add a fileInputRef to handle file attachment selection
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add a mediaRecorderRef to handle voice recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Add a audioChunksRef to store audio chunks
  const audioChunksRef = useRef<Blob[]>([]);

  // Add a recordingTimerRef to track recording duration
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add state for connection messages
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [conversationMessages, setConversationMessages] = useState<any[]>([]);
  const [selectedMessageForDeletion, setSelectedMessageForDeletion] = useState<any | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  // Add this state at the top of InboxPage
  const [showConversationsTab, setShowConversationsTab] = useState(false);

  // Add state for typing indicators and online status
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<{[key: string]: boolean}>({});
  const [onlineUsers, setOnlineUsers] = useState<{[key: string]: boolean}>({});
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const swapId = searchParams?.get('swapId');

  // Function to fetch swaps
  const fetchSwaps = async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch swaps where user is provider
      const providerSwapsQuery = query(
        collection(db, 'swaps'),
        where('providerId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      // Fetch swaps where user is receiver
      const receiverSwapsQuery = query(
        collection(db, 'swaps'),
        where('receiverId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const [providerSnapshot, receiverSnapshot] = await Promise.all([
        getDocs(providerSwapsQuery),
        getDocs(receiverSwapsQuery)
      ]);
      
      const providerSwaps = providerSnapshot.docs.map(doc => ({
        id: doc.id,
        providerId: doc.data().providerId || '',
        providerName: doc.data().providerName || 'Unknown Provider',
        providerService: doc.data().providerService || 'Unknown Service',
        providerServiceId: doc.data().providerServiceId || '',
        receiverId: doc.data().receiverId || '',
        receiverName: doc.data().receiverName || 'Unknown Receiver',
        receiverService: doc.data().receiverService || 'Unknown Service',
        receiverServiceId: doc.data().receiverServiceId || '',
        status: doc.data().status || 'pending',
        message: doc.data().message || '',
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        read: doc.data().read || false,
        providerMarkedComplete: doc.data().providerMarkedComplete || false,
        receiverMarkedComplete: doc.data().receiverMarkedComplete || false,
        messages: []
      }));
      
      const receiverSwaps = receiverSnapshot.docs.map(doc => ({
        id: doc.id,
        providerId: doc.data().providerId || '',
        providerName: doc.data().providerName || 'Unknown Provider',
        providerService: doc.data().providerService || 'Unknown Service',
        providerServiceId: doc.data().providerServiceId || '',
        receiverId: doc.data().receiverId || '',
        receiverName: doc.data().receiverName || 'Unknown Receiver',
        receiverService: doc.data().receiverService || 'Unknown Service',
        receiverServiceId: doc.data().receiverServiceId || '',
        status: doc.data().status || 'pending',
        message: doc.data().message || '',
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        read: doc.data().read || false,
        providerMarkedComplete: doc.data().providerMarkedComplete || false,
        receiverMarkedComplete: doc.data().receiverMarkedComplete || false,
        messages: []
      }));
      
      // Combine and sort all swaps by createdAt
      const allSwaps = [...providerSwaps, ...receiverSwaps].sort((a, b) => 
        b.createdAt.getTime() - a.createdAt.getTime()
      );
      
      // Fetch profile photos for all users in the swaps
      const userIds = new Set<string>();
      allSwaps.forEach(swap => {
        userIds.add(swap.providerId);
        userIds.add(swap.receiverId);
      });
      
      const userProfiles: Record<string, string> = {};
      const userPromises = Array.from(userIds).map(async (userId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists() && userDoc.data().photoURL) {
            userProfiles[userId] = userDoc.data().photoURL;
          }
        } catch (error) {
          console.error(`Error fetching profile for user ${userId}:`, error);
        }
      });
      
      await Promise.all(userPromises);
      
      // Add profile photos to swaps
      const swapsWithPhotos = allSwaps.map(swap => ({
        ...swap,
        providerPhoto: userProfiles[swap.providerId] || '',
        receiverPhoto: userProfiles[swap.receiverId] || ''
      }));
      
      setSwaps(swapsWithPhotos);
    } catch (error) {
      console.error('Error fetching swaps:', error);
      setError('Failed to fetch swaps. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch messages for a swap
  const fetchMessages = async (swapId: string): Promise<Unsubscribe | undefined> => {
    if (!user) return;
    
    try {
      setIsFetchingMessages(true);
      
      const messagesQuery = query(
        collection(db, 'swapMessages'),
        where('swapId', '==', swapId),
        orderBy('timestamp', 'asc')
      );
      
      // Replace getDocs with onSnapshot for real-time updates
      const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
        const messages: Message[] = [];
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          messages.push({
            id: doc.id,
            swapId: data.swapId,
            senderId: data.senderId,
            senderName: data.senderName,
            text: data.text || "",
            timestamp: data.timestamp?.toDate() || new Date(),
            attachmentUrl: data.attachmentUrl || undefined,
            attachmentType: data.attachmentType || undefined,
            read: data.read || false
          });
        });
        
        // Update the swap with messages
        setSwaps(prevSwaps => prevSwaps.map(swap => {
          if (swap.id === swapId) {
            return {
              ...swap,
              messages: messages
            };
          }
          return swap;
        }));
        
        // Scroll to the most recent message
        if (swapMessageContainerRef.current) {
          swapMessageContainerRef.current.scrollTop = swapMessageContainerRef.current.scrollHeight;
        }
        
        setIsFetchingMessages(false);
      });
      
      // Return the unsubscribe function
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching messages:', error);
      setIsFetchingMessages(false);
      return undefined;
    }
  };

  // Fetch messages for a swap
  useEffect(() => {
    let unsubscribeFunction: Unsubscribe | undefined;
    
    if (selectedSwap) {
      // Set up the real-time listener
      const setupListener = async () => {
        unsubscribeFunction = await fetchMessages(selectedSwap);
      };
      
      setupListener();
    }
    
    // Clean up listener when component unmounts or selected swap changes
    return () => {
      if (unsubscribeFunction) {
        unsubscribeFunction();
      }
    };
  }, [selectedSwap]);

  // Initial fetch of swaps
  useEffect(() => {
    fetchSwaps();
    // fetchConversations is now handled by a dedicated useEffect that sets up real-time updates
  }, [user]);

  // Get the active swap
  const activeSwap = swaps.find(
    (swap) => swap.id === selectedSwap
  );

  // Filter swaps based on search
  const filteredSwaps = swaps.filter((swap) =>
    swap.providerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    swap.receiverName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    swap.providerService.toLowerCase().includes(searchTerm.toLowerCase()) ||
    swap.receiverService.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Handle accepting a swap
  const handleAcceptSwap = async (swapId: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Update swap status
      await updateDoc(doc(db, 'swaps', swapId), {
        status: 'accepted',
        updatedAt: serverTimestamp()
      });

      // Get swap details for notification
      const swapDoc = await getDoc(doc(db, 'swaps', swapId));
      const swapData = swapDoc.data();
      
      if (swapData) {
        // Create notification for the requester
        await createSwapAcceptNotification(
          swapId,
          swapData.providerId,
          swapData.receiverId,
          swapData.providerServiceTitle || 'your service'
        );

        // Add a message to the conversation
        await addDoc(collection(db, 'swapMessages'), {
          swapId,
          senderId: user.uid,
          senderName: user.displayName || 'User',
          text: 'I accept your swap request!',
          timestamp: serverTimestamp(),
          read: false
        });
      }

      // Refresh the swaps list
      await fetchSwaps();
    } catch (error) {
      console.error('Error accepting swap:', error);
      setError('Failed to accept swap. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSwap = async (swapId: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Update swap status
      await updateDoc(doc(db, 'swaps', swapId), {
        status: 'rejected',
        updatedAt: serverTimestamp()
      });

      // Get swap details for notification
      const swapDoc = await getDoc(doc(db, 'swaps', swapId));
      const swapData = swapDoc.data();
      
      if (swapData) {
        // Create notification for the requester
        await createSwapRejectNotification(
          swapId,
          swapData.providerId,
          swapData.receiverId,
          swapData.providerServiceTitle || 'your service'
        );

        // Add a message to the conversation
        await addDoc(collection(db, 'swapMessages'), {
          swapId,
          senderId: user.uid,
          senderName: user.displayName || 'User',
          text: 'I decline your swap request.',
          timestamp: serverTimestamp(),
          read: false
        });
      }

      // Refresh the swaps list
      await fetchSwaps();
    } catch (error) {
      console.error('Error rejecting swap:', error);
      setError('Failed to reject swap. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Modify the markSwapAsRead logic to ensure unread messages are properly tracked
  useEffect(() => {
    const markSwapAsRead = async () => {
      if (selectedSwap && user) {
        const swap = swaps.find(s => s.id === selectedSwap);
        
        if (swap && !swap.read && swap.receiverId === user.uid) {
          try {
            console.log('Marking swap as read:', selectedSwap);
            const swapRef = doc(db, 'swaps', selectedSwap);
            await updateDoc(swapRef, {
              read: true
            });
            
            // Update the local state
            setSwaps(swaps.map(s => {
              if (s.id === selectedSwap) {
                return { ...s, read: true };
              }
              return s;
            }));
          } catch (error) {
            console.error('Error marking swap as read:', error);
          }
        }
      }
    };
    
    markSwapAsRead();
  }, [selectedSwap, swaps, user]);

  // Handle file attachment selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check if file is an image
      if (file.type.startsWith('image/')) {
        setAttachment(file);
        setAttachmentType('image');
      } else {
        alert('Please select an image file');
      }
    }
  };

  // Handle voice recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
        setRecordedAudio(audioBlob);
        setAttachmentType('voice');
        
        // Stop all tracks from the stream
        stream.getTracks().forEach(track => track.stop());
      };
      
      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
      
      // Set up a timer to track recording duration
      let seconds = 0;
      recordingTimerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingTime(seconds);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check your permissions.');
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Clear the timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };
  
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setRecordedAudio(null);
      setAttachmentType(null);
      
      // Clear the timer
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const clearAttachment = () => {
    setAttachment(null);
    setRecordedAudio(null);
    setAttachmentType(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Update handleSendMessage to include attachments
  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment && !recordedAudio) || !selectedSwap || !user || !activeSwap) return;
    
    setIsSendingMessage(true);
    
    try {
      let attachmentUrl = '';
      
      // Upload attachment if any
      if ((attachment || recordedAudio) && attachmentType) {
        const storage = getStorage(app);
        console.log('Using storage instance:', storage);
        const messageStorageRef = storageRef(storage, `swapMessages/${selectedSwap}/${Date.now()}${attachment ? `.${attachment.name.split('.').pop()}` : '.mp3'}`);
        
        // Convert Blob to File if needed
        const fileToUploadAsFile = attachment || (recordedAudio instanceof File 
          ? recordedAudio 
          : recordedAudio ? new File([recordedAudio as Blob], `voice-message-${Date.now()}.mp3`, { type: 'audio/mpeg' }) : null);
        if (!fileToUploadAsFile) throw new Error('No file to upload');
        await uploadBytes(messageStorageRef, fileToUploadAsFile);
        attachmentUrl = await getDownloadURL(messageStorageRef);
      }
      
      const messageData = {
        swapId: selectedSwap,
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous',
        text: newMessage.trim(),
        timestamp: Timestamp.now(),
        read: false,
        ...(attachmentUrl && attachmentType && { 
          attachmentUrl,
          attachmentType 
        })
      };
      
      // Add the message to the swapMessages collection
      const docRef = await addDoc(collection(db, 'swapMessages'), messageData);
      
      // Update the local state with the new message
      setSwaps(prevSwaps => prevSwaps.map(swap => {
        if (swap.id === selectedSwap) {
          return {
            ...swap,
            messages: [
              ...(swap.messages || []),
              {
                ...messageData,
                id: docRef.id,
                timestamp: new Date(),
              }
            ]
          };
        }
        return swap;
      }));
      
      // Clear inputs
      setNewMessage('');
      clearAttachment();
      
      // Clear typing indicator after sending message
      if (isTyping) {
        setIsTyping(false);
        handleTypingIndicator(false);
      }
      
      console.log('Message sent successfully with ID:', docRef.id);
      
      // Focus the input field for the next message
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
      
      // Get the recipient ID
      const recipientId = user.uid === activeSwap.providerId 
        ? activeSwap.receiverId 
        : activeSwap.providerId;
      
      // Check if the recipient is currently viewing this swap
      const otherUserActiveSwapRef = ref(realtimeDb, `activeSwap/${recipientId}`);
      const activeSwapSnapshot = await get(otherUserActiveSwapRef);
      const otherUserActiveSwap = activeSwapSnapshot.val();
      
      // Only send notification if they are not looking at this swap
      if (!otherUserActiveSwap || otherUserActiveSwap !== selectedSwap) {
        // Create notification for the other party
        await createNotification({
          userId: recipientId,
          type: 'message',
          senderId: user.uid,
          senderName: user.displayName || 'User',
          message: newMessage.trim() || (attachmentType === 'image' ? 'Sent an image' : attachmentType === 'voice' ? 'Sent a voice message' : 'New message'),
          swapId: selectedSwap
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Function to fetch connection conversations
  const fetchConversations = async (): Promise<Unsubscribe | undefined> => {
    if (!user) return;
    
    try {
      const conversationsQuery = query(
        collection(db, 'connectionMessages'),
        where('participants', 'array-contains', user.uid),
        orderBy('lastMessageTime', 'desc')
      );
      
      // Use onSnapshot for real-time updates
      const unsubscribe = onSnapshot(conversationsQuery, (snapshot) => {
        const conversationsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          messages: []
        }));
        
        setConversations(conversationsData);
        
        // If chatId is provided in URL params, select that conversation
        if (chatId && !activeConversation) {
          setActiveConversation(chatId);
        }
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      return undefined;
    }
  };

  // Add a useEffect to handle conversation list real-time updates
  useEffect(() => {
    let unsubscribeFunction: Unsubscribe | undefined;
    
    if (user) {
      const setupListener = async () => {
        unsubscribeFunction = await fetchConversations();
      };
      
      setupListener();
    }
    
    // Clean up listener when component unmounts
    return () => {
      if (unsubscribeFunction) {
        unsubscribeFunction();
      }
    };
  }, [user]);
  
  // Function to fetch messages for a conversation
  const fetchConversationMessages = async (conversationId: string): Promise<Unsubscribe | undefined> => {
    if (!user) return;
    
    try {
      const messagesQuery = query(
        collection(db, 'connectionMessages', conversationId, 'messages'),
        orderBy('timestamp', 'asc')
      );
      
      // Use onSnapshot for real-time updates
      const unsubscribe = onSnapshot(messagesQuery, async (snapshot) => {
        const messagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
        
        setConversationMessages(messagesData);
        
        // Only proceed with marking as read if user exists
        if (!user) return;
        
        // Mark messages as read
        const batch = writeBatch(db);
        let needsUpdate = false;
        
        messagesData.forEach((message: any) => {
          if (message.senderId !== user.uid && message.read && !message.read[user.uid]) {
            const messageRef = doc(db, 'connectionMessages', conversationId, 'messages', message.id);
            const newReadStatus = { ...message.read, [user.uid]: true };
            batch.update(messageRef, { read: newReadStatus });
            needsUpdate = true;
          }
        });
        
        // Update unread count in conversation document if needed
        if (needsUpdate) {
          const conversationRef = doc(db, 'connectionMessages', conversationId);
          batch.update(conversationRef, {
            [`unreadCount.${user.uid}`]: 0
          });
          
          await batch.commit();
        }
        
        // Scroll to the most recent message
        if (connectionMessageContainerRef.current) {
          connectionMessageContainerRef.current.scrollTop = connectionMessageContainerRef.current.scrollHeight;
        }
      });
      
      return unsubscribe;
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      return undefined;
    }
  };
  
  // Function to send a connection message
  const handleSendConnectionMessage = async () => {
    if (!newMessage.trim() && !attachment && !recordedAudio || !activeConversation || !user) return;
    
    setIsSendingMessage(true);
    
    try {
      let attachmentUrl = '';
      
      // Upload attachment if any
      if ((attachment || recordedAudio) && attachmentType) {
        const storage = getStorage(app);
        console.log('Using storage instance:', storage);
        const connectionStorageRef = storageRef(storage, `connectionMessages/${activeConversation}/${Date.now()}${attachment ? `.${attachment.name.split('.').pop()}` : '.mp3'}`);
        
        // Convert Blob to File if needed
        const fileToUploadAsFile = attachment || (recordedAudio instanceof File 
          ? recordedAudio 
          : recordedAudio ? new File([recordedAudio as Blob], `voice-message-${Date.now()}.mp3`, { type: 'audio/mpeg' }) : null);
        if (!fileToUploadAsFile) throw new Error('No file to upload');
        await uploadBytes(connectionStorageRef, fileToUploadAsFile);
        attachmentUrl = await getDownloadURL(connectionStorageRef);
      }
      
      // Get conversation data to know participants
      const conversation = conversations.find(c => c.id === activeConversation);
      if (!conversation) {
        throw new Error('Conversation not found');
      }
      
      // Create read status object for all participants
      const readStatus: {[key: string]: boolean} = {};
      conversation.participants.forEach((participantId: string) => {
        readStatus[participantId] = participantId === user.uid;
      });
      
      // Add the message
      const messageData = {
        senderId: user.uid,
        senderName: user.displayName || 'You',
        text: newMessage.trim(),
        timestamp: serverTimestamp(),
        read: readStatus,
        ...(attachmentUrl && attachmentType && { 
          attachmentUrl,
          attachmentType 
        })
      };
      
      // Add the message to the messages subcollection
      const docRef = await addDoc(
        collection(db, 'connectionMessages', activeConversation, 'messages'), 
        messageData
      );
      
      // Update the conversation document with the last message
      await updateDoc(doc(db, 'connectionMessages', activeConversation), {
        lastMessage: newMessage.trim() || 'Attachment',
        lastMessageTime: serverTimestamp(),
        // Increment unread count for other participants
        ...Object.fromEntries(
          conversation.participants
            .filter((participantId: string) => participantId !== user.uid)
            .map((participantId: string) => [
              `unreadCount.${participantId}`, 
              (conversation.unreadCount?.[participantId] || 0) + 1
            ])
        )
      });
      
      // Update local state with new message
      setConversationMessages([
        ...conversationMessages,
        {
          ...messageData,
          id: docRef.id,
          timestamp: new Date()
        }
      ]);
      
      // Clear inputs
      setNewMessage('');
      clearAttachment();
      
      // Clear typing indicator after sending message
      if (isTyping) {
        setIsTyping(false);
        handleTypingIndicator(false);
      }
      
      // Focus the input field for the next message
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }

      // Send notification to other participant(s) only if they're not currently viewing this conversation
      // Check the Firebase RTDB to see if they have this conversation open
      conversation.participants.forEach(async (participantId: string) => {
        if (participantId !== user.uid) {
          // Check if the other user is currently looking at this conversation
          const otherUserActiveConversationRef = ref(realtimeDb, `activeConversation/${participantId}`);
          const activeConversationSnapshot = await get(otherUserActiveConversationRef);
          const otherUserActiveConversation = activeConversationSnapshot.val();
          
          // Only send notification if they are not looking at this conversation
          if (!otherUserActiveConversation || otherUserActiveConversation !== activeConversation) {
            createNotification({
              userId: participantId,
              type: 'message',
              senderId: user.uid,
              senderName: user.displayName || 'User',
              conversationId: activeConversation,
              message: newMessage.trim() || (attachmentType === 'image' ? 'Sent an image' : attachmentType === 'voice' ? 'Sent a voice message' : 'New message')
            });
          }
        }
      });
    } catch (error) {
      console.error('Error sending connection message:', error);
    } finally {
      setIsSendingMessage(false);
    }
  };
  
  // Function to delete a message
  const handleDeleteMessage = (message: any) => {
    setSelectedMessageForDeletion(message);
    setShowDeleteConfirmation(true);
  };
  
  // Function to confirm message deletion
  const confirmDeleteMessage = async () => {
    if (!selectedMessageForDeletion || !activeConversation) return;
    
    try {
      // Delete the message
      await deleteDoc(
        doc(db, 'connectionMessages', activeConversation, 'messages', selectedMessageForDeletion.id)
      );
      
      // Remove from local state
      setConversationMessages(
        conversationMessages.filter(msg => msg.id !== selectedMessageForDeletion.id)
      );
      
      // Check if this was the last message and update conversation if needed
      const isLastMessage = conversations.find(c => c.id === activeConversation)?.lastMessage === selectedMessageForDeletion.text;
      
      if (isLastMessage) {
        // Find the new last message
        const remainingMessages = conversationMessages.filter(msg => msg.id !== selectedMessageForDeletion.id);
        const newLastMessage = remainingMessages.length > 0 
          ? remainingMessages[remainingMessages.length - 1]
          : null;
        
        if (newLastMessage) {
          await updateDoc(doc(db, 'connectionMessages', activeConversation), {
            lastMessage: newLastMessage.text || 'Attachment',
            lastMessageTime: newLastMessage.timestamp
          });
        } else {
          // No messages left
          await updateDoc(doc(db, 'connectionMessages', activeConversation), {
            lastMessage: '',
            lastMessageTime: serverTimestamp()
          });
        }
      }
    } catch (error) {
      console.error('Error deleting message:', error);
    } finally {
      setSelectedMessageForDeletion(null);
      setShowDeleteConfirmation(false);
    }
  };
  
  // Function to cancel message deletion
  const cancelDeleteMessage = () => {
    setSelectedMessageForDeletion(null);
    setShowDeleteConfirmation(false);
  };

  // Auto-select Conversations tab if chatId is present in URL
  useEffect(() => {
    if (chatId) {
      setShowConversationsTab(true);
      setActiveConversation(chatId);
      // fetchConversationMessages is now handled by another useEffect that sets up real-time updates
    }
  }, [chatId]);

  // Add this useEffect after the definition of selectedSwap and searchParams
  useEffect(() => {
    if (
      swapId &&
      !isLoading &&
      swaps.length > 0 &&
      swaps.some(s => s.id === swapId)
    ) {
      setShowConversationsTab(false);
      setSelectedSwap(swapId);
    }
  }, [swapId, swaps, isLoading]);

  const handleMarkComplete = async (swapId: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get the swap to check current completion status
      const swapDoc = await getDoc(doc(db, 'swaps', swapId));
      const swapData = swapDoc.data();
      
      if (!swapData) {
        throw new Error('Swap not found');
      }
      
      const isProvider = user.uid === swapData.providerId;
      const updateData: any = {};
      
      // Update the appropriate field based on whether user is provider or receiver
      if (isProvider) {
        updateData.providerMarkedComplete = true;
      } else {
        updateData.receiverMarkedComplete = true;
      }
      
      // Check if both parties will have marked complete
      const bothMarkedComplete = 
        (isProvider && swapData.receiverMarkedComplete) || 
        (!isProvider && swapData.providerMarkedComplete);
      
      // If both have marked complete, update status to completed
      if (bothMarkedComplete) {
        updateData.status = 'completed';
      }
      
      updateData.updatedAt = serverTimestamp();
      
      // Update the swap
      await updateDoc(doc(db, 'swaps', swapId), updateData);
      
      // Add a system message to the conversation
      await addDoc(collection(db, 'swapMessages'), {
        swapId,
        senderId: 'system',
        senderName: 'System',
        text: bothMarkedComplete 
          ? 'Both parties have marked the swap as complete!' 
          : `${user.displayName || 'User'} has marked the swap as complete.`,
        timestamp: serverTimestamp(),
        read: false
      });
      
      // Update the local state
      setSwaps(swaps.map(swap => {
        if (swap.id === swapId) {
          const updatedSwap = { ...swap };
          
          if (isProvider) {
            updatedSwap.providerMarkedComplete = true;
          } else {
            updatedSwap.receiverMarkedComplete = true;
          }
          
          if (bothMarkedComplete) {
            updatedSwap.status = 'completed';
          }
          
          updatedSwap.updatedAt = new Date();
          return updatedSwap;
        }
        return swap;
      }));
      
      // Create notification for the other party
      const otherPartyId = isProvider ? swapData.receiverId : swapData.providerId;
      await createNotification({
        userId: otherPartyId,
        type: 'message',
        senderId: user.uid,
        senderName: user.displayName || 'User',
        message: bothMarkedComplete 
          ? 'The swap has been completed!' 
          : `${user.displayName || 'User'} has marked the swap as complete.`,
        swapId: swapId
      });
      
      // Refresh messages
      if (selectedSwap === swapId) {
        fetchMessages(swapId);
      }
      
    } catch (error) {
      console.error('Error marking swap as complete:', error);
      setError('Failed to mark swap as complete. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Setup user's online status
  useEffect(() => {
    if (!user) return;
    
    // User presence system
    const userStatusRef = ref(realtimeDb, `status/${user.uid}`);
    const userStatusDatabaseRef = ref(realtimeDb, '.info/connected');
    
    // Listen for connection changes
    const unsubscribeConnection = onValue(userStatusDatabaseRef, (snapshot) => {
      // If we're connected to Firebase Database
      if (snapshot.val() === true) {
        // Set the user status to online when connected
        const onlineStatus = {
          state: 'online',
          last_changed: rtdbServerTimestamp(),
        };
        
        // Set up disconnect handler to change status to offline when disconnected
        onDisconnect(userStatusRef)
          .set({
            state: 'offline',
            last_changed: rtdbServerTimestamp(),
          })
          .then(() => {
            // If we're still connected, set the status to online
            set(userStatusRef, onlineStatus);
          });
      }
    });
    
    // Clean up listener
    return () => {
      unsubscribeConnection();
      // Set status to offline on unmount
      set(userStatusRef, {
        state: 'offline',
        last_changed: rtdbServerTimestamp(),
      });
    };
  }, [user]);
  
  // Listen for online users status updates when in a conversation
  useEffect(() => {
    if (!user || !activeConversation) return;
    
    // Find the other participants in the conversation
    const conversation = conversations.find(c => c.id === activeConversation);
    if (!conversation) return;
    
    const otherParticipants = conversation.participants.filter((id: string) => id !== user.uid);
    if (otherParticipants.length === 0) return;
    
    // Set up listeners for each participant's status
    const statusRefs: DatabaseReference[] = otherParticipants.map((participantId: string) => 
      ref(realtimeDb, `status/${participantId}`)
    );
    
    const unsubscribes: Unsubscribe[] = statusRefs.map((statusRef: DatabaseReference, index: number) => 
      onValue(statusRef, (snapshot) => {
        const status = snapshot.val();
        if (status) {
          setOnlineUsers(prev => ({
            ...prev,
            [otherParticipants[index]]: status.state === 'online'
          }));
        }
      })
    );
    
    // Clean up listeners
    return () => {
      unsubscribes.forEach((unsubscribe: Unsubscribe) => unsubscribe());
    };
  }, [user, activeConversation, conversations]);
  
  // Set up listener for typing indicators when in a conversation
  useEffect(() => {
    if (!user || !activeConversation) return;
    
    // Find the other participants in the conversation
    const conversation = conversations.find(c => c.id === activeConversation);
    if (!conversation) return;
    
    const otherParticipants = conversation.participants.filter((id: string) => id !== user.uid);
    if (otherParticipants.length === 0) return;
    
    // Set up listeners for each participant's typing status
    const typingRefs: DatabaseReference[] = otherParticipants.map((participantId: string) => 
      ref(realtimeDb, `typing/${activeConversation}/${participantId}`)
    );
    
    const unsubscribes: Unsubscribe[] = typingRefs.map((typingRef: DatabaseReference, index: number) => 
      onValue(typingRef, (snapshot) => {
        const isUserTyping = snapshot.val();
        if (isUserTyping !== null) {
          setTypingUsers(prev => ({
            ...prev,
            [otherParticipants[index]]: isUserTyping
          }));
        }
      })
    );
    
    // Clean up listeners
    return () => {
      unsubscribes.forEach((unsubscribe: Unsubscribe) => unsubscribe());
    };
  }, [user, activeConversation, conversations]);
  
  // Handle typing indicator
  const handleTypingIndicator = (isTyping: boolean) => {
    if (!user || !activeConversation) return;
    
    // Update typing status in realtime database
    const typingRef = ref(realtimeDb, `typing/${activeConversation}/${user.uid}`);
    set(typingRef, isTyping);
    
    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    // If typing, set a timeout to clear the typing indicator after 3 seconds of inactivity
    if (isTyping) {
      typingTimeoutRef.current = setTimeout(() => {
        set(typingRef, false);
        setIsTyping(false);
      }, 3000);
    }
  };

  // Add this useEffect to handle real-time conversation messages and cleanup
  useEffect(() => {
    let unsubscribeFunction: Unsubscribe | undefined;
    
    if (activeConversation) {
      const setupListener = async () => {
        unsubscribeFunction = await fetchConversationMessages(activeConversation);
      };
      
      setupListener();
    }
    
    // Clean up listener when component unmounts or active conversation changes
    return () => {
      if (unsubscribeFunction) {
        unsubscribeFunction();
      }
    };
  }, [activeConversation, user]);

  // Add this useEffect to update the active conversation in Firebase Realtime Database
  useEffect(() => {
    if (!user || !activeConversation) return;
    
    // Update active conversation in Firebase Realtime DB
    const activeConversationRef = ref(realtimeDb, `activeConversation/${user.uid}`);
    set(activeConversationRef, activeConversation);
    
    // Clear active conversation when component unmounts or conversation changes
    return () => {
      set(activeConversationRef, null);
    };
  }, [user, activeConversation]);

  // Add this useEffect to update the active swap in Firebase Realtime Database
  useEffect(() => {
    if (!user || !selectedSwap) return;
    
    // Update active swap in Firebase Realtime DB
    const activeSwapRef = ref(realtimeDb, `activeSwap/${user.uid}`);
    set(activeSwapRef, selectedSwap);
    
    // Clear active swap when component unmounts or swap changes
    return () => {
      set(activeSwapRef, null);
    };
  }, [user, selectedSwap]);

  return (
    <div className="h-[calc(100vh-7rem)] flex flex-col max-w-full mx-auto overflow-hidden">
      {/* Mobile-friendly content area */}
      <div className="flex flex-1 overflow-hidden rounded-lg border shadow bg-white">
        {/* Tabs for swaps and connections - responsive width */}
        <div className={`${selectedSwap || activeConversation ? 'hidden md:block' : 'w-full'} md:w-1/3 border-r overflow-hidden flex flex-col`}>
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => {
                  setShowConversationsTab(false);
                  setActiveConversation(null);
                  setConversationMessages([]);
                }}
                className={`flex-1 py-3 text-sm font-medium border-b-2 ${
                  !showConversationsTab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Swaps
              </button>
              <button
                onClick={() => {
                  setShowConversationsTab(true);
                  setSelectedSwap(null);
                }}
                className={`flex-1 py-3 text-sm font-medium border-b-2 ${
                  showConversationsTab ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Conversations
              </button>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1">
            {/* Show swaps if Swaps tab is selected */}
            {!showConversationsTab && (
              isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : filteredSwaps.length > 0 ? (
            filteredSwaps.map((swap) => {
              const isCurrentUserProvider = swap.providerId === user?.uid;
              const otherPersonName = isCurrentUserProvider ? swap.receiverName : swap.providerName;
              const otherPersonId = isCurrentUserProvider ? swap.receiverId : swap.providerId;
              const otherPersonPhoto = isCurrentUserProvider ? swap.receiverPhoto : swap.providerPhoto;
              const swapTitle = `${swap.providerService} ↔ ${swap.receiverService}`;
              const unread = !swap.read && swap.receiverId === user?.uid;
              const statusColor = {
                pending: 'bg-yellow-100 text-yellow-800',
                accepted: 'bg-blue-100 text-blue-800',
                completed: 'bg-green-100 text-green-800',
                declined: 'bg-red-100 text-red-800',
                cancelled: 'bg-gray-100 text-gray-800',
              }[swap.status];
              
              return (
                <div
                  key={swap.id}
                  className={`flex items-center gap-3 p-4 cursor-pointer border-b transition-colors hover:bg-gray-50 ${
                    selectedSwap === swap.id ? 'bg-indigo-50' : ''
                  } ${unread ? 'font-semibold' : ''}`}
                  onClick={() => setSelectedSwap(swap.id)}
                >
                  <div className="relative flex-shrink-0">
                    {otherPersonPhoto ? (
                      <Image
                        src={otherPersonPhoto}
                        alt={otherPersonName}
                        width={48}
                        height={48}
                        className="h-12 w-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-lg flex items-center justify-center">
                        {otherPersonName.charAt(0).toUpperCase()}
                    </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <p className="text-sm font-medium text-gray-900 truncate">{otherPersonName}</p>
                      <p className="text-xs text-gray-500 flex-shrink-0 ml-1">{swap.createdAt.toLocaleDateString()}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-600 truncate max-w-[120px] sm:max-w-[200px]">{swapTitle}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${statusColor}`}>
                        {swap.status}
                      </span>
                    </div>
                    {unread && (
                      <div className="mt-1 flex justify-end">
                        <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-12 w-12 text-gray-300 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              <p className="text-gray-500 text-sm">No swaps match your search</p>
            </div>
              )
          )}
            
            {/* Show conversations if Conversations tab is selected */}
            {showConversationsTab && (
              conversations.length > 0 ? (
                conversations.map((conversation) => {
                  // Find the other participant
                  const otherParticipantId = conversation.participants.find((id: string) => id !== user?.uid);
                  const otherParticipantName = conversation.participantNames?.[otherParticipantId || ''] || 'User';
                  const otherParticipantPhoto = conversation.participantPhotos?.[otherParticipantId || ''] || '';
                  const unreadCount = user?.uid ? (conversation.unreadCount?.[user.uid] || 0) : 0;
                  // Use lastMessage for preview
                  const lastMessagePreview = conversation.lastMessage || '';
                  // Use the real-time online status from the state
                  const isOnline = otherParticipantId ? onlineUsers[otherParticipantId] : false;
                  
                  return (
                    <div
                      key={conversation.id}
                      className={`flex items-center gap-3 p-4 cursor-pointer border-b transition-colors hover:bg-gray-50 ${
                        activeConversation === conversation.id ? 'bg-indigo-50' : ''
                      }`}
                      onClick={() => {
                        setActiveConversation(conversation.id);
                        fetchConversationMessages(conversation.id);
                      }}
                    >
                      <div className="relative flex-shrink-0">
                        {otherParticipantPhoto ? (
                          <Image
                            src={otherParticipantPhoto}
                            alt={otherParticipantName}
                            width={48}
                            height={48}
                            className="h-12 w-12 rounded-full object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-lg flex items-center justify-center">
                            {otherParticipantName.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full ring-2 ring-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <p className="text-sm font-medium text-gray-900 truncate">{otherParticipantName}</p>
                          <p className="text-xs text-gray-500 flex-shrink-0 ml-1">
                            {conversation.lastMessageTime?.toDate()?.toLocaleDateString() || ''}
                          </p>
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-xs text-gray-600 truncate max-w-[120px] sm:max-w-[200px]">{lastMessagePreview}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {isOnline ? 'online' : 'offline'}
                          </span>
                        </div>
                        {unreadCount > 0 && (
                          <div className="mt-1 flex justify-end">
                            <span className="h-2 w-2 rounded-full bg-indigo-600"></span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 text-gray-300 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  <p className="text-gray-500 text-sm">No conversations yet</p>
                  <p className="text-xs text-gray-400 mt-1">Connect with users to start chatting</p>
                </div>
              )
            )}
          </div>
        </div>

        {/* Right panel: Show swap or conversation chat depending on tab */}
        <div className={`${selectedSwap || activeConversation ? 'flex' : 'hidden md:flex'} flex-1 md:w-2/3 flex-col overflow-hidden`}>
          {/* Mobile back button - only visible on mobile when chat is open */}
          {(selectedSwap || activeConversation) && (
            <div className="md:hidden bg-gray-50 p-2 border-b">
              <button 
                onClick={() => {
                  setSelectedSwap(null);
                  setActiveConversation(null);
                }}
                className="flex items-center text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back
              </button>
            </div>
          )}

          {/* Swaps tab: show swap chat */}
          {!showConversationsTab && selectedSwap && activeSwap ? (
            <>
              {/* Swap header */}
              <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {(() => {
                      const isCurrentUserProvider = activeSwap.providerId === user?.uid;
                      const otherPersonPhoto = isCurrentUserProvider ? activeSwap.receiverPhoto : activeSwap.providerPhoto;
                      const otherPersonName = isCurrentUserProvider ? activeSwap.receiverName : activeSwap.providerName;
                      
                      return otherPersonPhoto ? (
                        <Image
                          src={otherPersonPhoto}
                          alt={otherPersonName}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-lg flex items-center justify-center">
                          {otherPersonName.charAt(0).toUpperCase()}
                    </div>
                      );
                    })()}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 flex items-center gap-1">
                      {activeSwap.providerId === user?.uid ? activeSwap.receiverName : activeSwap.providerName}
                      <VerificationBadge userId={activeSwap.providerId === user?.uid ? activeSwap.receiverId : activeSwap.providerId} className="h-5 w-5 align-text-bottom" />
                    </h3>
                    <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${
                      {
                        pending: 'bg-yellow-100 text-yellow-800',
                        accepted: 'bg-blue-100 text-blue-800',
                        completed: 'bg-green-100 text-green-800',
                        declined: 'bg-red-100 text-red-800',
                        cancelled: 'bg-gray-100 text-gray-800',
                      }[activeSwap.status]
                    }`}>
                      {activeSwap.status.charAt(0).toUpperCase() + activeSwap.status.slice(1)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link 
                    href={`/profile/${activeSwap.providerId === user?.uid ? activeSwap.receiverId : activeSwap.providerId}#portfolio`}
                    className="px-3 py-1 text-sm border border-indigo-200 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    View Profile
                  </Link>
                  <Link 
                    href="/dashboard/swaps"
                    className="p-2 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Redesigned Swap details and messages section */}
              <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden overflow-x-hidden w-full max-w-full">
                {/* Swap details - only visible for pending swaps */}
                {activeSwap.status === 'pending' && (
                  <div className="bg-white p-3 rounded-lg shadow-sm m-3 mb-2 sticky top-0 z-10">
                    <div className="flex justify-between items-center mb-1">
                      <h3 className="font-semibold text-md">Swap Proposal</h3>
                      {activeSwap.receiverId === user?.uid && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRejectSwap(activeSwap.id)}
                            className="px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            Decline
                          </button>
                          <button
                            onClick={() => handleAcceptSwap(activeSwap.id)}
                            className="px-2 py-1 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            Accept
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="border rounded-lg p-2 bg-indigo-50">
                        <p className="text-xs text-gray-500 mb-0.5">Provider</p>
                        <p className="font-medium text-sm">{activeSwap.providerService}</p>
                        <p className="text-xs text-gray-600">{activeSwap.providerName}</p>
                      </div>
                      <div className="border rounded-lg p-2 bg-purple-50">
                        <p className="text-xs text-gray-500 mb-0.5">Receiver</p>
                        <p className="font-medium text-sm">{activeSwap.receiverService}</p>
                        <p className="text-xs text-gray-600">{activeSwap.receiverName}</p>
                      </div>
                    </div>
                    
                    <div className="border-t pt-2 mt-1">
                      <div className="flex flex-col">
                        <p className="text-xs text-gray-500 mb-1">Initial Message:</p>
                        <p className="text-xs text-gray-700 whitespace-pre-wrap break-words max-w-full">
                          {activeSwap.message || "No message provided."}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-1 text-xs text-gray-500">
                      Proposed on {activeSwap.createdAt.toLocaleDateString()} at {activeSwap.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                )}
                
                {/* Status banners */}
                {activeSwap.status === 'declined' && (
                  <div className="bg-red-50 border border-red-200 p-2 rounded-lg mx-3 mb-2 text-sm text-red-800 sticky top-0 z-10">
                    This swap proposal has been declined.
                  </div>
                )}
                
                {activeSwap.status === 'accepted' && (
                  <div className="bg-green-50 border border-green-200 p-2 rounded-lg mx-3 mb-2 text-sm text-green-800 sticky top-0 z-10">
                    <div className="flex flex-col">
                      <div>This swap has been accepted! View in <Link href="/dashboard/swaps" className="font-medium underline">Swaps dashboard</Link>.</div>
                      
                      {/* Show completion status */}
                      <div className="mt-1 text-xs flex items-center gap-2">
                        <span>Completion status:</span>
                        <div className="flex items-center bg-white px-2 py-1 rounded-md">
                          <span className={`h-2 w-2 rounded-full mr-1 ${activeSwap.providerMarkedComplete ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className="text-xs">{activeSwap.providerName}</span>
                        </div>
                        <div className="flex items-center bg-white px-2 py-1 rounded-md">
                          <span className={`h-2 w-2 rounded-full mr-1 ${activeSwap.receiverMarkedComplete ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className="text-xs">{activeSwap.receiverName}</span>
                        </div>
                      </div>
                      
                      {/* Mark complete button */}
                      {!((user?.uid === activeSwap.providerId && activeSwap.providerMarkedComplete) || 
                         (user?.uid === activeSwap.receiverId && activeSwap.receiverMarkedComplete)) && (
                        <button
                          onClick={() => handleMarkComplete(activeSwap.id)}
                          className="mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 self-start"
                          disabled={loading}
                        >
                          {loading ? 'Processing...' : 'Mark as Complete'}
                        </button>
                      )}
                      
                      {/* Show waiting message if user already marked complete */}
                      {((user?.uid === activeSwap.providerId && activeSwap.providerMarkedComplete && !activeSwap.receiverMarkedComplete) || 
                        (user?.uid === activeSwap.receiverId && activeSwap.receiverMarkedComplete && !activeSwap.providerMarkedComplete)) && (
                        <div className="mt-2 text-xs font-medium text-green-700">
                          Waiting for the other party to mark as complete...
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {activeSwap.status === 'completed' && (
                  <div className="bg-blue-50 border border-blue-200 p-2 rounded-lg mx-3 mb-2 text-sm text-blue-800 sticky top-0 z-10">
                    This swap has been completed successfully!
                  </div>
                )}
                
                {/* Messages section with auto-scroll */}
                <div className="flex-1 overflow-hidden flex flex-col" ref={swapMessageContainerRef}>
                  <MessagesContainer 
                    messages={activeSwap.messages || []} 
                    userId={user?.uid} 
                  />
                </div>
              </div>

              {/* Message input */}
              <div className="p-3 border-t bg-white">
                {(attachment || recordedAudio) && (
                  <div className="mb-2 p-2 bg-gray-50 border rounded-md flex items-center justify-between">
                    <div className="flex items-center">
                      {attachmentType === 'image' && (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm truncate max-w-[150px]">{attachment?.name}</span>
                        </>
                      )}
                      {attachmentType === 'voice' && (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">Voice message recorded</span>
                        </>
                      )}
                    </div>
                    <button 
                      onClick={clearAttachment}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
                
                {isRecording && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
                      <span className="text-sm text-red-700">Recording: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={cancelRecording}
                        className="text-gray-600 hover:text-gray-800 p-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button 
                        onClick={stopRecording}
                        className="bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    disabled={isRecording}
                    title="Attach image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2 rounded-full transition-colors ${
                      isRecording 
                        ? 'text-red-500 hover:text-red-600 hover:bg-red-50' 
                        : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                    title={isRecording ? "Stop recording" : "Record voice message"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  <input
                    ref={messageInputRef}
                    type="text"
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      
                      // Only trigger typing indicator if it's not already active
                      if (e.target.value.trim().length > 0 && !isTyping) {
                        setIsTyping(true);
                        handleTypingIndicator(true);
                      } else if (e.target.value.trim().length === 0 && isTyping) {
                        setIsTyping(false);
                        handleTypingIndicator(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    onBlur={() => {
                      // Clear typing indicator when user leaves the input field
                      if (isTyping) {
                        setIsTyping(false);
                        handleTypingIndicator(false);
                      }
                    }}
                    disabled={isRecording}
                  />
                  
                  <button
                    className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    onClick={handleSendMessage}
                    disabled={(!newMessage.trim() && !attachment && !recordedAudio) || isSendingMessage || isRecording}
                  >
                    {isSendingMessage ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {/* Conversations tab: show connection chat */}
          {showConversationsTab && activeConversation ? (
            <>
              {/* Conversation header */}
              <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {conversations.find(c => c.id === activeConversation)?.participantPhotos?.[
                      conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid) || ''
                    ] ? (
                      <Image
                        src={conversations.find(c => c.id === activeConversation)?.participantPhotos?.[
                          conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid) || ''
                        ]}
                        alt="User avatar"
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-600 font-semibold text-lg flex items-center justify-center">
                        {(conversations.find(c => c.id === activeConversation)?.participantNames?.[
                          conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid) || ''
                        ] || 'User').charAt(0).toUpperCase()}
                      </div>
                    )}
                    
                    {/* Online status indicator - use real online status */}
                    {(() => {
                      const otherParticipantId = conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid);
                      const isOnline = otherParticipantId ? onlineUsers[otherParticipantId] : false;
                      return (
                        <span className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                      );
                    })()}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 flex items-center gap-1">
                      {conversations.find(c => c.id === activeConversation)?.participantNames?.[
                        conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid) || ''
                      ] || 'User'}
                      <VerificationBadge userId={conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid) || ''} className="h-5 w-5 align-text-bottom" />
                    </h3>
                    {(() => {
                      const otherParticipantId = conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid);
                      const isOnline = otherParticipantId ? onlineUsers[otherParticipantId] : false;
                      return (
                        <div className={`text-xs px-2 py-0.5 rounded-full inline-block ${isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                          {isOnline ? 'Online' : 'Offline'}
                        </div>
                      );
                    })()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link 
                    href={`/profile/${conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid)}`}
                    className="px-3 py-1 text-sm border border-indigo-200 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    View Profile
                  </Link>
                </div>
              </div>

              {/* Messages section */}
              <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden overflow-x-hidden w-full">
                <div className="flex-1 overflow-hidden flex flex-col" ref={connectionMessageContainerRef}>
                  <ConnectionMessagesContainer 
                    messages={conversationMessages} 
                    userId={user?.uid} 
                    onDeleteMessage={handleDeleteMessage}
                  />
                  
                  {/* Typing indicator */}
                  {(() => {
                    const otherParticipantId = conversations.find(c => c.id === activeConversation)?.participants.find((id: string) => id !== user?.uid);
                    const isTyping = otherParticipantId ? typingUsers[otherParticipantId] : false;
                    if (isTyping) {
                      return (
                        <div className="px-4 pb-2">
                          <div className="bg-gray-200 px-4 py-2 rounded-full inline-flex items-center space-x-1 text-sm text-gray-600">
                            <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></span>
                            <span className="w-2 h-2 bg-gray-600 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>

              {/* Message input for connections */}
              <div className="p-3 border-t bg-white">
                {(attachment || recordedAudio) && (
                  <div className="mb-2 p-2 bg-gray-50 border rounded-md flex items-center justify-between">
                    <div className="flex items-center">
                      {attachmentType === 'image' && (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm truncate max-w-[150px]">{attachment?.name}</span>
                        </>
                      )}
                      {attachmentType === 'voice' && (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                          </svg>
                          <span className="text-sm">Voice message recorded</span>
                        </>
                      )}
                    </div>
                    <button 
                      onClick={clearAttachment}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
                {isRecording && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="h-2 w-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
                      <span className="text-sm text-red-700">Recording: {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}</span>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={cancelRecording}
                        className="text-gray-600 hover:text-gray-800 p-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <button 
                        onClick={stopRecording}
                        className="bg-red-600 text-white p-1 rounded-full hover:bg-red-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex gap-2 items-center">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-full text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                    disabled={isRecording}
                    title="Attach image"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`p-2 rounded-full transition-colors ${
                      isRecording 
                        ? 'text-red-500 hover:text-red-600 hover:bg-red-50' 
                        : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
                    }`}
                    title={isRecording ? "Stop recording" : "Record voice message"}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <input
                    ref={messageInputRef}
                    type="text"
                    className="flex-1 py-2 px-4 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => {
                      setNewMessage(e.target.value);
                      
                      // Update typing indicator
                      const isCurrentlyTyping = e.target.value.trim().length > 0;
                      if (isCurrentlyTyping !== isTyping) {
                        setIsTyping(isCurrentlyTyping);
                        handleTypingIndicator(isCurrentlyTyping);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendConnectionMessage();
                      }
                    }}
                    onBlur={() => {
                      // Clear typing indicator when user leaves the input field
                      if (isTyping) {
                        setIsTyping(false);
                        handleTypingIndicator(false);
                      }
                    }}
                    disabled={isRecording}
                  />
                  <button
                    className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
                    onClick={handleSendConnectionMessage}
                    disabled={(!newMessage.trim() && !attachment && !recordedAudio) || isSendingMessage || isRecording}
                  >
                    {isSendingMessage ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {/* Prompt if nothing selected */}
          {((!showConversationsTab && !selectedSwap) || (showConversationsTab && !activeConversation)) && (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <div className="h-24 w-24 rounded-full bg-indigo-100 flex items-center justify-center mb-6">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-medium text-gray-900 mb-2">
                {showConversationsTab ? 'Select a conversation to start chatting' : 'Your swap inbox'}
              </h3>
              <p className="text-gray-600 max-w-md mb-4">
                {showConversationsTab
                  ? 'Choose a connection from the list to view and send messages.'
                  : 'Connect with other service providers and view swap proposals. Select a swap to see details.'}
              </p>
              {!showConversationsTab && (
              <div className="flex gap-2">
                <Link 
                  href="/marketplace"
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Browse marketplace
                </Link>
              </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Delete confirmation modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">Delete Message</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to permanently delete this message? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={cancelDeleteMessage}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteMessage}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 