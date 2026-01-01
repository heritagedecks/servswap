'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/app/context/AuthContext';
import { db, realtimeDb } from '@/app/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { createNotification } from '@/app/lib/notifications';
import { UserCircle, ChevronRight, CheckCircle, XCircle, MoreHorizontal, Trash2, Shield, UserX, LucideUsers, UserPlus, Search } from 'lucide-react';
import ProfileAvatar from '@/app/components/ProfileAvatar';

// Add a new interface to define the user search result type
interface UserSearchResult {
  uid: string;
  displayName?: string;
  photoURL?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  [key: string]: any; // For any other properties that might be in the user data
}

interface Connection {
  id: string;
  users: string[];
  status: string;
  createdAt: Date;
  lastActive?: Date;
  userData?: {
    displayName: string;
    photoURL: string;
    online: boolean;
  }[];
}

interface ConnectionRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  fromUserPhoto: string;
  toUserId: string;
  status: string;
  createdAt: Date;
}

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

export default function ConnectionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check for tab parameter in URL and set initial tab
  const initialTab = searchParams?.get('tab');
  const [activeTab, setActiveTab] = useState<'online' | 'all' | 'requests' | 'search'>(
    initialTab === 'requests' ? 'requests' : 'online'
  );
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionRequests, setConnectionRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [messageLoadingId, setMessageLoadingId] = useState<string | null>(null);
  
  // User search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [locationFilter, setLocationFilter] = useState('');
  const [skillsFilter, setSkillsFilter] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<{ [userId: string]: 'none' | 'pending' | 'connected' | 'incoming' }>({});
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [mutualConnections, setMutualConnections] = useState<{ [userId: string]: number }>({});
  
  // Add state for online users tracking
  const [onlineUsers, setOnlineUsers] = useState<{[key: string]: boolean}>({});
  
  // Setup user's own online status
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

  // Track online status of all connections
  useEffect(() => {
    if (!user || connections.length === 0) return;
    
    // Get the list of connection user IDs (excluding current user)
    const connectionUserIds = connections
      .flatMap(connection => connection.users)
      .filter(id => id !== user.uid);
    
    // Create unique list of user IDs
    const uniqueUserIds = [...new Set(connectionUserIds)];
    
    // Create a ref for each user to monitor their status
    const statusRefs = uniqueUserIds.map(userId => 
      ref(realtimeDb, `status/${userId}`)
    );
    
    // Set up listeners for each connection's status
    const unsubscribes = statusRefs.map((statusRef, index) => 
      onValue(statusRef, (snapshot) => {
        const status = snapshot.val();
        if (status) {
          const userId = uniqueUserIds[index];
          setOnlineUsers(prev => ({
            ...prev,
            [userId]: status.state === 'online'
          }));
          
          // Also update the connections array with this online status
          setConnections(prevConnections => 
            prevConnections.map(connection => {
              const otherUserId = connection.users.find(id => id !== user.uid);
              if (otherUserId === userId && connection.userData) {
                return {
                  ...connection,
                  userData: [{
                    ...connection.userData[0],
                    online: status.state === 'online'
                  }]
                };
              }
              return connection;
            })
          );
        }
      })
    );
    
    // Clean up listeners
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [user, connections]);

  useEffect(() => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    
    // Fetch connections
    const fetchConnections = async () => {
      setLoading(true);
      
      const connectionsQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', user.uid),
        where('status', '==', 'connected')
      );
      
      const unsubscribe = onSnapshot(connectionsQuery, async (snapshot) => {
        const connectionsData: Connection[] = [];
        
        for (const docSnapshot of snapshot.docs) {
          const data = docSnapshot.data();
          const otherUserId = data.users.find((id: string) => id !== user?.uid);
          
          if (otherUserId) {
            try {
              const userDocRef = doc(db, 'users', otherUserId);
              const userDocSnap = await getDoc(userDocRef);
              const userData = userDocSnap.data() || {};
              
              // Check if we have real-time online status from Firebase RTDB
              const isOnline = onlineUsers[otherUserId] || false;
              
              connectionsData.push({
                id: docSnapshot.id,
                users: data.users,
                status: data.status,
                createdAt: data.createdAt?.toDate() || new Date(),
                lastActive: data.lastActive?.toDate(),
                userData: [{
                  displayName: userData.displayName || 'User',
                  photoURL: userData.photoURL || '',
                  online: isOnline // Use real-time status
                }]
              });
            } catch (error) {
              console.error(`Error fetching user data for ${otherUserId}:`, error);
            }
          }
        }
        
        // Sort connections: online first, then by most recently active
        connectionsData.sort((a, b) => {
          // First sort by online status
          if (a.userData?.[0]?.online && !b.userData?.[0]?.online) return -1;
          if (!a.userData?.[0]?.online && b.userData?.[0]?.online) return 1;
          
          // Then by lastActive date (most recent first)
          const aTime = a.lastActive?.getTime() || 0;
          const bTime = b.lastActive?.getTime() || 0;
          return bTime - aTime;
        });
        
        setConnections(connectionsData);
        setLoading(false);
      });
      
      return unsubscribe;
    };
    
    // Fetch connection requests
    const fetchConnectionRequests = async () => {
      const requestsQuery = query(
        collection(db, 'connectionRequests'),
        where('toUserId', '==', user.uid),
        where('status', '==', 'pending')
      );
      
      const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
        const requestsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        })) as ConnectionRequest[];
        
        setConnectionRequests(requestsData);
      });
      
      return unsubscribe;
    };
    
    const connectionsUnsubscribe = fetchConnections();
    const requestsUnsubscribe = fetchConnectionRequests();
    
    return () => {
      Promise.resolve(connectionsUnsubscribe).then(unsub => {
        if (typeof unsub === 'function') unsub();
      });
      Promise.resolve(requestsUnsubscribe).then(unsub => {
        if (typeof unsub === 'function') unsub();
      });
    };
  }, [user, router]);
  
  // Accept connection request
  const handleAcceptRequest = async (request: ConnectionRequest) => {
    if (!user) return;
    
    try {
      // First check if a connection already exists between these users
      const existingConnectionQuery1 = query(
        collection(db, 'connections'),
        where('users', 'array-contains', user.uid),
        where('status', '==', 'connected')
      );
      
      const existingConnectionSnap1 = await getDocs(existingConnectionQuery1);
      const alreadyConnected = existingConnectionSnap1.docs.some(doc => {
        const data = doc.data();
        return data.users.includes(request.fromUserId);
      });
      
      if (alreadyConnected) {
        // Connection already exists, just update the request status
        await updateDoc(doc(db, 'connectionRequests', request.id), {
          status: 'accepted'
        });
        
        // Create a notification for accepted request
        await createNotification({
          userId: request.fromUserId,
          type: 'follow',
          senderId: user.uid,
          senderName: user.displayName || 'User',
          message: `${user.displayName || 'User'} accepted your request to connect`,
          link: '/dashboard/connections'
        });
        
        // Remove from requests list
        setConnectionRequests(prev => prev.filter(r => r.id !== request.id));
        return;
      }
      
      // Update the request status
      await updateDoc(doc(db, 'connectionRequests', request.id), {
        status: 'accepted'
      });
      
      // Create a connection
      await addDoc(collection(db, 'connections'), {
        users: [user.uid, request.fromUserId],
        status: 'connected',
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp()
      });
      
      // Create a notification for accepted request
      await createNotification({
        userId: request.fromUserId,
        type: 'follow',
        senderId: user.uid,
        senderName: user.displayName || 'User',
        message: `${user.displayName || 'User'} accepted your request to connect`,
        link: '/dashboard/connections'
      });
      
      // Remove from requests list
      setConnectionRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error) {
      console.error('Error accepting connection request:', error);
      alert('Failed to accept connection request');
    }
  };
  
  // Decline connection request
  const handleDeclineRequest = async (request: ConnectionRequest) => {
    if (!user) return;
    
    try {
      // Update the request status
      await updateDoc(doc(db, 'connectionRequests', request.id), {
        status: 'declined'
      });
      
      // Create a notification for declined request
      await createNotification({
        userId: request.fromUserId,
        type: 'follow',
        senderId: user.uid,
        senderName: user.displayName || 'User',
        message: `${user.displayName || 'User'} declined your request to connect`,
        link: '/dashboard/connections'
      });
      
      // Remove from requests list
      setConnectionRequests(prev => prev.filter(r => r.id !== request.id));
    } catch (error) {
      console.error('Error declining connection request:', error);
      alert('Failed to decline connection request');
    }
  };
  
  // Remove connection
  const handleRemoveConnection = async (connection: Connection) => {
    try {
      // Delete the connection
      await deleteDoc(doc(db, 'connections', connection.id));
      
      // Remove from connections list
      setConnections(prev => prev.filter(c => c.id !== connection.id));
      
      setDropdownOpen(null);
    } catch (error) {
      console.error('Error removing connection:', error);
      alert('Failed to remove connection');
    }
  };
  
  // Block user
  const handleBlockUser = async (connection: Connection) => {
    if (!user) return;
    
    try {
      // Get the other user's ID
      const otherUserId = connection.users.find(id => id !== user.uid);
      
      if (!otherUserId) {
        throw new Error('Could not identify the user to block');
      }
      
      // Delete the connection
      await deleteDoc(doc(db, 'connections', connection.id));
      
      // Add to blocked users
      await addDoc(collection(db, 'blockedUsers'), {
        blockedBy: user.uid,
        blockedUser: otherUserId,
        createdAt: serverTimestamp()
      });
      
      // Remove from connections list
      setConnections(prev => prev.filter(c => c.id !== connection.id));
      
      alert('User has been blocked');
      setDropdownOpen(null);
    } catch (error) {
      console.error('Error blocking user:', error);
      alert('Failed to block user');
    }
  };
  
  // Toggle user dropdown menu
  const toggleDropdown = (id: string) => {
    if (dropdownOpen === id) {
      setDropdownOpen(null);
    } else {
      setDropdownOpen(id);
    }
  };
  
  // Handle messaging a connection
  const handleMessage = async (connection: Connection) => {
    if (!user) return;
    setMessageLoadingId(connection.id);
    try {
      const otherUserId = connection.users.find(id => id !== user.uid);
      if (!otherUserId) return;
      // Query for all conversations where the current user is a participant
      const conversationsQuery = query(
        collection(db, 'connectionMessages'),
        where('participants', 'array-contains', user.uid)
      );
      const conversationsSnap = await getDocs(conversationsQuery);
      // Find a conversation where participants are exactly [user.uid, otherUserId] (order doesn't matter)
      let existingConversationId: string | null = null;
      conversationsSnap.forEach(doc => {
        const data = doc.data();
        const participants = data.participants || [];
        if (
          participants.length === 2 &&
          participants.includes(user.uid) &&
          participants.includes(otherUserId)
        ) {
          existingConversationId = doc.id;
        }
      });
      if (existingConversationId) {
        router.push(`/dashboard/inbox?chat=${existingConversationId}`);
      } else {
        // Create a new conversation
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
        const userData = userDoc.data() || {};
        const otherUserData = otherUserDoc.data() || {};
        const newConversation = {
          participants: [user.uid, otherUserId],
          participantNames: {
            [user.uid]: userData.displayName || 'You',
            [otherUserId]: otherUserData.displayName || 'Connection'
          },
          participantPhotos: {
            [user.uid]: userData.photoURL || '',
            [otherUserId]: otherUserData.photoURL || ''
          },
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          createdAt: serverTimestamp(),
          unreadCount: {
            [user.uid]: 0,
            [otherUserId]: 0
          }
        };
        const conversationRef = await addDoc(collection(db, 'connectionMessages'), newConversation);
        // Add welcome message to the conversation
        await addDoc(collection(db, 'connectionMessages', conversationRef.id, 'messages'), {
          senderId: user.uid,
          senderName: userData.displayName || 'You',
          text: `Hello! I'd like to connect with you.`,
          timestamp: serverTimestamp(),
          read: {
            [user.uid]: true,
            [otherUserId]: false
          }
        });
        router.push(`/dashboard/inbox?chat=${conversationRef.id}`);
      }
    } catch (error) {
      console.error('Error setting up conversation:', error);
      alert('Failed to set up conversation. Please try again.');
    } finally {
      setMessageLoadingId(null);
    }
  };
  
  // Handle user search
  const handleUserSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchTerm.trim() || !user) return;
    
    setIsSearching(true);
    setSearchResults([]);
    
    try {
      // Query for users based on displayName
      const usersRef = collection(db, 'users');
      const searchTermLower = searchTerm.toLowerCase();
      
      // Using a prefix search approach for displayName
      const nameQuery = query(
        usersRef,
        orderBy('displayName')
      );
      
      const nameSnap = await getDocs(nameQuery);
      
      // Manually filter results since Firestore doesn't have a native 'contains' operator for strings
      let matchingUsers = nameSnap.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserSearchResult))
        .filter(userData => 
          // Only include if the display name contains the search term
          userData.displayName?.toLowerCase().includes(searchTermLower) && 
          // Exclude the current user
          userData.uid !== user.uid
        );
      
      // Apply location filter if set
      if (locationFilter) {
        matchingUsers = matchingUsers.filter(userData => 
          userData.location?.toLowerCase().includes(locationFilter.toLowerCase())
        );
      }
      
      // Get profile data for each user to check skills filter
      const enrichedUsers = await Promise.all(
        matchingUsers.map(async (userData) => {
          // Get profile data for additional info
          const profileSnap = await getDoc(doc(db, 'profiles', userData.uid));
          const profileData = profileSnap.exists() ? profileSnap.data() : {};
          
          // Apply skills filter if set
          if (skillsFilter && (!profileData.skills || 
              !profileData.skills.some((skill: string) => 
                skill.toLowerCase().includes(skillsFilter.toLowerCase())
              ))) {
            return null;
          }
          
          // Check connection status
          const status = await checkConnectionStatus(userData.uid);
          setConnectionStatus(prev => ({ ...prev, [userData.uid]: status }));
          
          // Check for mutual connections
          const mutualCount = await checkMutualConnectionsCount(userData.uid);
          setMutualConnections(prev => ({ ...prev, [userData.uid]: mutualCount }));
          
          return {
            ...userData,
            skills: profileData.skills || [],
            bio: profileData.bio || '',
            location: profileData.location || userData.location || ''
          } as UserSearchResult;
        })
      );
      
      // Filter out null results (from skills filter)
      const filteredResults = enrichedUsers.filter((user): user is UserSearchResult => user !== null);
      setSearchResults(filteredResults);
    } catch (error) {
      console.error('Error searching for users:', error);
    } finally {
      setIsSearching(false);
    }
  };
  
  // Helper function to check connection status
  const checkConnectionStatus = async (targetUserId: string): Promise<'none' | 'pending' | 'connected' | 'incoming'> => {
    if (!user) return 'none';
    
    try {
      // Check if already connected
      const existingConnectionQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', user.uid),
        where('status', '==', 'connected')
      );
      
      const existingConnectionSnap = await getDocs(existingConnectionQuery);
      const alreadyConnected = existingConnectionSnap.docs.some(doc => {
        const data = doc.data();
        return data.users.includes(targetUserId);
      });
      
      if (alreadyConnected) {
        return 'connected';
      }
      
      // Check for outgoing request
      const outgoingRequestQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', user.uid),
        where('toUserId', '==', targetUserId),
        where('status', 'in', ['pending', 'accepted'])
      );
      
      const outgoingRequestSnap = await getDocs(outgoingRequestQuery);
      
      if (!outgoingRequestSnap.empty) {
        return 'pending';
      }
      
      // Check for incoming request
      const incomingRequestQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', targetUserId),
        where('toUserId', '==', user.uid),
        where('status', '==', 'pending')
      );
      
      const incomingRequestSnap = await getDocs(incomingRequestQuery);
      
      if (!incomingRequestSnap.empty) {
        return 'incoming';
      }
      
      return 'none';
    } catch (error) {
      console.error('Error checking connection status:', error);
      return 'none';
    }
  };
  
  // Helper function to check mutual connections count
  const checkMutualConnectionsCount = async (targetUserId: string): Promise<number> => {
    if (!user) return 0;
    
    try {
      // Get current user's connections
      const userConnectionsQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', user.uid),
        where('status', '==', 'connected')
      );
      
      const userConnectionsSnap = await getDocs(userConnectionsQuery);
      const userConnections = new Set(
        userConnectionsSnap.docs.flatMap(doc => 
          doc.data().users.filter((id: string) => id !== user.uid)
        )
      );
      
      // Get target user's connections
      const targetConnectionsQuery = query(
        collection(db, 'connections'),
        where('users', 'array-contains', targetUserId),
        where('status', '==', 'connected')
      );
      
      const targetConnectionsSnap = await getDocs(targetConnectionsQuery);
      const targetConnections = new Set(
        targetConnectionsSnap.docs.flatMap(doc => 
          doc.data().users.filter((id: string) => id !== targetUserId)
        )
      );
      
      // Find intersection
      let mutualCount = 0;
      for (const connection of userConnections) {
        if (targetConnections.has(connection)) {
          mutualCount++;
        }
      }
      
      return mutualCount;
    } catch (error) {
      console.error('Error checking mutual connections:', error);
      return 0;
    }
  };
  
  // Handle connecting with a user
  const handleConnectWithUser = async (targetUserId: string) => {
    if (!user) return;
    setConnectingId(targetUserId);
    
    try {
      // If there's an incoming request, accept it
      if (connectionStatus[targetUserId] === 'incoming') {
        // Find the request
        const incomingRequestQuery = query(
          collection(db, 'connectionRequests'),
          where('fromUserId', '==', targetUserId),
          where('toUserId', '==', user.uid),
          where('status', '==', 'pending')
        );
        
        const incomingRequestSnap = await getDocs(incomingRequestQuery);
        
        if (!incomingRequestSnap.empty) {
          const request = incomingRequestSnap.docs[0];
          
          // Update the request
          await updateDoc(doc(db, 'connectionRequests', request.id), {
            status: 'accepted'
          });
          
          // Create a connection
          await addDoc(collection(db, 'connections'), {
            users: [user.uid, targetUserId],
            status: 'connected',
            createdAt: serverTimestamp(),
            lastActive: serverTimestamp()
          });
          
          // Update status
          setConnectionStatus(prev => ({ ...prev, [targetUserId]: 'connected' }));
          
          // Create notification
          await createNotification({
            userId: targetUserId,
            type: 'follow',
            senderId: user.uid,
            senderName: user.displayName || 'User',
            message: `${user.displayName || 'User'} accepted your request to connect`,
            link: '/dashboard/connections'
          });
          
          setConnectingId(null);
          return;
        }
      }
      
      // For new connections, send a request
      const requestData = {
        fromUserId: user.uid,
        fromUserName: user.displayName || 'User',
        fromUserPhoto: user.photoURL || '',
        toUserId: targetUserId,
        status: 'pending',
        createdAt: serverTimestamp()
      };
      
      await addDoc(collection(db, 'connectionRequests'), requestData);
      
      // Create notification
      await createNotification({
        userId: targetUserId,
        type: 'follow',
        senderId: user.uid,
        senderName: user.displayName || 'User',
        message: `${user.displayName || 'User'} wants to connect with you`,
        link: '/dashboard/connections?tab=requests'
      });
      
      // Update UI
      setConnectionStatus(prev => ({ ...prev, [targetUserId]: 'pending' }));
    } catch (error) {
      console.error('Error connecting with user:', error);
    } finally {
      setConnectingId(null);
    }
  };
  
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-6xl bg-white rounded-xl shadow-md">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <LucideUsers className="h-7 w-7 text-indigo-600" />
            Connections
          </h1>
          
          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <div className="flex -mb-px">
              <button
                onClick={() => setActiveTab('online')}
                className={`mr-8 py-4 text-sm font-medium ${
                  activeTab === 'online'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Online Connections
                {connections.filter(c => c.userData?.[0]?.online).length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                    {connections.filter(c => c.userData?.[0]?.online).length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('all')}
                className={`mr-8 py-4 text-sm font-medium ${
                  activeTab === 'all'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Connections
                <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                  {connections.length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab('requests')}
                className={`mr-8 py-4 text-sm font-medium ${
                  activeTab === 'requests'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Connection Requests
                {connectionRequests.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                    {connectionRequests.length}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => setActiveTab('search')}
                className={`py-4 text-sm font-medium ${
                  activeTab === 'search'
                    ? 'border-b-2 border-indigo-500 text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Find Users
              </button>
            </div>
          </div>
          
          {/* Content based on active tab */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <>
              {/* Online Connections */}
              {activeTab === 'online' && (
                <div className="space-y-4">
                  {connections.filter(c => c.userData?.[0]?.online).length > 0 ? (
                    connections
                      .filter(c => c.userData?.[0]?.online)
                      .map(connection => (
                        <div key={connection.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
                          <div className="flex items-center">
                            <div className="relative">
                              <ProfileAvatar
                                src={connection.userData?.[0]?.photoURL}
                                alt={connection.userData?.[0]?.displayName || 'User'}
                                size={48}
                                userId={connection.users.find(id => id !== user?.uid)}
                              />
                              <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></span>
                            </div>
                            <div className="ml-3">
                              <Link href={`/profile/${connection.users.find(id => id !== user?.uid)}`} className="text-base font-medium text-gray-900 hover:text-indigo-600 flex items-center gap-1">
                                {connection.userData?.[0]?.displayName}
                                <VerificationBadge userId={connection.users.find(id => id !== user?.uid) || ''} className="h-5 w-5 align-text-bottom" />
                              </Link>
                              <p className="text-sm text-green-600">Online</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <button
                              onClick={() => handleMessage(connection)}
                              className="mr-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center justify-center"
                              disabled={messageLoadingId === connection.id}
                            >
                              {messageLoadingId === connection.id ? (
                                <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                              ) : (
                                "Message"
                              )}
                            </button>
                            
                            <div className="relative">
                              <button
                                onClick={() => toggleDropdown(connection.id)}
                                className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                              >
                                <MoreHorizontal className="h-5 w-5" />
                              </button>
                              
                              {dropdownOpen === connection.id && (
                                <div className="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                                  <div className="py-1" role="menu" aria-orientation="vertical">
                                    <button
                                      onClick={() => handleRemoveConnection(connection)}
                                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                      role="menuitem"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4 text-gray-500" />
                                      Remove Connection
                                    </button>
                                    <button
                                      onClick={() => handleBlockUser(connection)}
                                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                      role="menuitem"
                                    >
                                      <Shield className="mr-2 h-4 w-4 text-red-500" />
                                      Block User
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-12">
                      <UserCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900">No online connections</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        None of your connections are currently online.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* All Connections */}
              {activeTab === 'all' && (
                <div className="space-y-4">
                  {connections.length > 0 ? (
                    connections.map(connection => (
                      <div key={connection.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
                        <div className="flex items-center">
                          <div className="relative">
                            <ProfileAvatar
                              src={connection.userData?.[0]?.photoURL}
                              alt={connection.userData?.[0]?.displayName || 'User'}
                              size={48}
                              userId={connection.users.find(id => id !== user?.uid)}
                            />
                            {connection.userData?.[0]?.online && (
                              <span className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white"></span>
                            )}
                          </div>
                          <div className="ml-3">
                            <Link href={`/profile/${connection.users.find(id => id !== user?.uid)}`} className="text-base font-medium text-gray-900 hover:text-indigo-600 flex items-center gap-1">
                              {connection.userData?.[0]?.displayName}
                              <VerificationBadge userId={connection.users.find(id => id !== user?.uid) || ''} className="h-5 w-5 align-text-bottom" />
                            </Link>
                            <p className="text-sm text-gray-500">
                              {connection.userData?.[0]?.online ? (
                                <span className="text-green-600">Online</span>
                              ) : (
                                <span>
                                  Last active: {connection.lastActive?.toLocaleDateString() || 'Unknown'}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          <button
                            onClick={() => handleMessage(connection)}
                            className="mr-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center justify-center"
                            disabled={messageLoadingId === connection.id}
                          >
                            {messageLoadingId === connection.id ? (
                              <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                            ) : (
                              "Message"
                            )}
                          </button>
                          
                          <div className="relative">
                            <button
                              onClick={() => toggleDropdown(connection.id)}
                              className="p-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                            >
                              <MoreHorizontal className="h-5 w-5" />
                            </button>
                            
                            {dropdownOpen === connection.id && (
                              <div className="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                                <div className="py-1" role="menu" aria-orientation="vertical">
                                  <button
                                    onClick={() => handleRemoveConnection(connection)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    role="menuitem"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4 text-gray-500" />
                                    Remove Connection
                                  </button>
                                  <button
                                    onClick={() => handleBlockUser(connection)}
                                    className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                    role="menuitem"
                                  >
                                    <UserX className="mr-2 h-4 w-4 text-red-500" />
                                    Block User
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <UserCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900">No connections yet</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Start connecting with other users to build your network.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Connection Requests */}
              {activeTab === 'requests' && (
                <div className="space-y-4">
                  {connectionRequests.length > 0 ? (
                    connectionRequests.map(request => (
                      <div key={request.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:bg-gray-50">
                        <div className="flex items-center">
                          <div className="relative">
                            <ProfileAvatar
                              src={request.fromUserPhoto}
                              alt={request.fromUserName}
                              size={48}
                              userId={request.fromUserId}
                            />
                          </div>
                          <div className="ml-3">
                            <Link href={`/profile/${request.fromUserId}`} className="text-base font-medium text-gray-900 hover:text-indigo-600">
                              {request.fromUserName}
                            </Link>
                            <p className="text-sm text-gray-500">
                              Sent a connection request {request.createdAt.toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleAcceptRequest(request)}
                            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(request)}
                            className="flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Decline
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <UserCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-gray-900">No pending requests</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        You don't have any connection requests at the moment.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Search Users Tab */}
              {activeTab === 'search' && (
                <div>
                  <div className="mb-6">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                      <h2 className="text-lg font-semibold text-gray-900 mb-3">Find Swappers</h2>
                      <form onSubmit={handleUserSearch} className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-grow">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </div>
                          <input
                            type="text"
                            placeholder="Search by name..."
                            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-300"
                        >
                          Search
                        </button>
                      </form>
                      
                      {/* Optional filters */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <select 
                          value={locationFilter} 
                          onChange={(e) => setLocationFilter(e.target.value)}
                          className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white"
                        >
                          <option value="">All Locations</option>
                          <option value="Remote">Remote</option>
                          <option value="United States">United States</option>
                          <option value="Canada">Canada</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="Europe">Europe</option>
                          <option value="Asia">Asia</option>
                          <option value="Australia">Australia</option>
                        </select>
                        
                        <select 
                          value={skillsFilter} 
                          onChange={(e) => setSkillsFilter(e.target.value)}
                          className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg bg-white"
                        >
                          <option value="">All Skills</option>
                          <option value="Web Development">Web Development</option>
                          <option value="Design">Design</option>
                          <option value="Marketing">Marketing</option>
                          <option value="Writing">Writing</option>
                          <option value="Business">Business</option>
                          <option value="Education">Education</option>
                          <option value="Health">Health</option>
                          <option value="Technology">Technology</option>
                        </select>
                      </div>
                    </div>
                    
                    {/* Search Results */}
                    {isSearching ? (
                      <div className="flex justify-center py-8">
                        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="mt-4 space-y-3">
                        <h3 className="text-sm font-medium text-gray-500">Search Results ({searchResults.length})</h3>
                        {searchResults.map(user => (
                          <div key={user.uid} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                            <div className="flex items-center gap-3">
                              <div className="relative flex-shrink-0">
                                <ProfileAvatar 
                                  src={user.photoURL} 
                                  alt={user.displayName || 'User'} 
                                  size={48}
                                  userId={user.uid}
                                />
                              </div>
                              <div>
                                <Link href={`/profile/${user.uid}`} className="font-medium text-gray-900 hover:text-indigo-600 flex items-center">
                                  {user.displayName || 'User'}
                                  <VerificationBadge userId={user.uid} className="h-4 w-4 ml-1" />
                                </Link>
                                <p className="text-sm text-gray-500">{user.location || 'No location'}</p>
                                {user.skills && user.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {user.skills.slice(0, 2).map((skill: string, i: number) => (
                                      <span key={i} className="text-xs bg-indigo-100 text-indigo-800 rounded-full px-2 py-0.5">
                                        {skill}
                                      </span>
                                    ))}
                                    {user.skills.length > 2 && (
                                      <span className="text-xs text-gray-500">+{user.skills.length - 2} more</span>
                                    )}
                                  </div>
                                )}
                                {mutualConnections[user.uid] > 0 && (
                                  <p className="text-xs text-indigo-600 mt-1">
                                    {mutualConnections[user.uid]} mutual {mutualConnections[user.uid] === 1 ? 'connection' : 'connections'}
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handleConnectWithUser(user.uid)}
                              disabled={
                                connectionStatus[user.uid] === 'connected' || 
                                connectionStatus[user.uid] === 'pending' || 
                                connectingId === user.uid
                              }
                              className={`ml-4 px-3 py-1.5 rounded-lg text-sm font-medium ${
                                connectingId === user.uid
                                  ? 'bg-gray-200 text-gray-500 cursor-wait'
                                  : connectionStatus[user.uid] === 'connected'
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : connectionStatus[user.uid] === 'pending'
                                  ? 'bg-blue-100 text-blue-700 cursor-default'
                                  : connectionStatus[user.uid] === 'incoming'
                                  ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {connectingId === user.uid ? (
                                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-1"></span>
                              ) : connectionStatus[user.uid] === 'connected' ? (
                                'Connected'
                              ) : connectionStatus[user.uid] === 'pending' ? (
                                'Request Sent'
                              ) : connectionStatus[user.uid] === 'incoming' ? (
                                'Accept Request'
                              ) : (
                                'Connect'
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : searchTerm && !isSearching ? (
                      <div className="mt-4 bg-white rounded-lg border border-gray-200 p-6 text-center">
                        <UserCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-600 mb-1">No users found matching your search criteria.</p>
                        <p className="text-sm text-gray-500">Try a different search term or remove some filters.</p>
                      </div>
                    ) : (
                      <div className="mt-4 bg-white rounded-lg border border-gray-200 p-6 text-center">
                        <div className="bg-indigo-50 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">Find other swappers</h3>
                        <p className="text-gray-600 max-w-md mx-auto">
                          Search for other users by name to connect and exchange services based on your skills and talents.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}