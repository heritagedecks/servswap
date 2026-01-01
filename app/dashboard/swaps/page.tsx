'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';

// Define status types for swaps
type SwapStatus = 'pending' | 'accepted' | 'completed' | 'declined' | 'cancelled';

interface Swap {
  id: string;
  providerId: string;
  providerName: string;
  providerService: string;
  receiverId: string;
  receiverName: string;
  receiverService: string;
  status: SwapStatus;
  message: string;
  createdAt: Date;
  updatedAt: Date;
  providerMarkedComplete?: boolean;
  receiverMarkedComplete?: boolean;
}

export default function SwapsPage() {
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'active' | 'completed'>('all');
  const { user } = useAuth();
  const searchParams = useSearchParams();

  // Check for tab parameter in URL
  useEffect(() => {
    const tabParam = searchParams?.get('tab');
    if (tabParam === 'pending' || tabParam === 'active' || tabParam === 'completed') {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchSwaps = async () => {
      if (!user) return;
      
      console.log('============ DEBUG SWAPS START ============');
      console.log('Current user:', user.uid, user.displayName || user.email);
      
      setIsLoading(true);
      try {
        // Direct check of a swap document to understand structure
        try {
          const swapsRef = collection(db, 'swaps');
          const snapshot = await getDocs(swapsRef);
          console.log('Total swaps in database:', snapshot.size);
          
          if (snapshot.size > 0) {
            console.log('Sample swap document:');
            const sampleDoc = snapshot.docs[0];
            console.log('ID:', sampleDoc.id);
            console.log('Data:', sampleDoc.data());
          }
        } catch (error) {
          console.error('Error checking swaps collection:', error);
        }
        
        // Get swaps where the user is either the provider or receiver
        console.log('Querying for provider swaps with userId:', user.uid);
        const providerQuery = query(
          collection(db, 'swaps'),
          where('providerId', '==', user.uid)
          // Removed the orderBy until we confirm the index is created
        );
        
        console.log('Querying for receiver swaps with userId:', user.uid);
        const receiverQuery = query(
          collection(db, 'swaps'),
          where('receiverId', '==', user.uid)
          // Removed the orderBy until we confirm the index is created
        );
        
        let providerSnapshot, receiverSnapshot;
        
        try {
          providerSnapshot = await getDocs(providerQuery);
          console.log('Provider swaps found:', providerSnapshot.size);
          providerSnapshot.forEach(doc => {
            console.log('  Provider swap:', doc.id, doc.data());
          });
        } catch (error) {
          console.error('Error fetching provider swaps:', error);
          providerSnapshot = { docs: [], forEach: () => {} };
        }
        
        try {
          receiverSnapshot = await getDocs(receiverQuery);
          console.log('Receiver swaps found:', receiverSnapshot.size);
          receiverSnapshot.forEach(doc => {
            console.log('  Receiver swap:', doc.id, doc.data());
          });
        } catch (error) {
          console.error('Error fetching receiver swaps:', error);
          receiverSnapshot = { docs: [], forEach: () => {} };
        }
        
        const swapsList: Swap[] = [];
        
        providerSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Processing provider swap:', doc.id);
          
          // Check for required fields
          if (!data.providerId) console.warn('Missing providerId', doc.id);
          if (!data.providerName) console.warn('Missing providerName', doc.id);
          if (!data.providerService) console.warn('Missing providerService', doc.id);
          if (!data.receiverId) console.warn('Missing receiverId', doc.id);
          if (!data.receiverName) console.warn('Missing receiverName', doc.id);
          if (!data.receiverService) console.warn('Missing receiverService', doc.id);
          if (!data.status) console.warn('Missing status', doc.id);
          
          swapsList.push({
            id: doc.id,
            providerId: data.providerId || '',
            providerName: data.providerName || 'Unknown Provider',
            providerService: data.providerService || 'Unknown Service',
            receiverId: data.receiverId || '',
            receiverName: data.receiverName || 'Unknown Receiver',
            receiverService: data.receiverService || 'Unknown Service',
            status: data.status || 'pending',
            message: data.message || '',
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            providerMarkedComplete: data.providerMarkedComplete || false,
            receiverMarkedComplete: data.receiverMarkedComplete || false,
          });
        });
        
        // Only add receiver swaps that aren't already in the list
        receiverSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Processing receiver swap:', doc.id);
          
          // Check for required fields
          if (!data.providerId) console.warn('Missing providerId', doc.id);
          if (!data.providerName) console.warn('Missing providerName', doc.id);
          if (!data.providerService) console.warn('Missing providerService', doc.id);
          if (!data.receiverId) console.warn('Missing receiverId', doc.id);
          if (!data.receiverName) console.warn('Missing receiverName', doc.id);
          if (!data.receiverService) console.warn('Missing receiverService', doc.id);
          if (!data.status) console.warn('Missing status', doc.id);
          
          if (!swapsList.some(swap => swap.id === doc.id)) {
            swapsList.push({
              id: doc.id,
              providerId: data.providerId || '',
              providerName: data.providerName || 'Unknown Provider',
              providerService: data.providerService || 'Unknown Service',
              receiverId: data.receiverId || '',
              receiverName: data.receiverName || 'Unknown Receiver',
              receiverService: data.receiverService || 'Unknown Service',
              status: data.status || 'pending',
              message: data.message || '',
              createdAt: data.createdAt?.toDate() || new Date(),
              updatedAt: data.updatedAt?.toDate() || new Date(),
              providerMarkedComplete: data.providerMarkedComplete || false,
              receiverMarkedComplete: data.receiverMarkedComplete || false,
            });
          }
        });
        
        // Sort by creation date (newest first)
        swapsList.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        console.log('Final swaps list:', swapsList);
        console.log('============ DEBUG SWAPS END ============');
        
        setSwaps(swapsList);
      } catch (error) {
        console.error('Error fetching swaps:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSwaps();
  }, [user]);

  // Filter swaps based on active tab
  const filteredSwaps = swaps.filter(swap => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return swap.status === 'pending';
    if (activeTab === 'active') return swap.status === 'accepted';
    if (activeTab === 'completed') return swap.status === 'completed';
    return true;
  });

  // Handle accepting a swap
  const handleAcceptSwap = async (swapId: string) => {
    try {
      const swapRef = doc(db, 'swaps', swapId);
      await updateDoc(swapRef, {
        status: 'accepted',
        updatedAt: Timestamp.now(),
      });
      
      // Update the local state
      setSwaps(swaps.map(swap => {
        if (swap.id === swapId) {
          return {
            ...swap,
            status: 'accepted',
            updatedAt: new Date()
          };
        }
        return swap;
      }));
    } catch (error) {
      console.error('Error accepting swap:', error);
    }
  };
  
  // Handle declining a swap
  const handleDeclineSwap = async (swapId: string) => {
    try {
      const swapRef = doc(db, 'swaps', swapId);
      await updateDoc(swapRef, {
        status: 'declined',
        updatedAt: Timestamp.now(),
      });
      
      // Update the local state
      setSwaps(swaps.map(swap => {
        if (swap.id === swapId) {
          return {
            ...swap,
            status: 'declined',
            updatedAt: new Date()
          };
        }
        return swap;
      }));
    } catch (error) {
      console.error('Error declining swap:', error);
    }
  };
  
  // Handle completing a swap
  const handleMarkComplete = async (swapId: string) => {
    if (!user) return;
    
    try {
      const swapRef = doc(db, 'swaps', swapId);
      
      // Get the current swap data
      const swapDoc = await getDoc(swapRef);
      
      if (!swapDoc.exists()) {
        console.error('Swap not found:', swapId);
        return;
      }
      
      const swapData = swapDoc.data();
      const isProvider = user.uid === swapData.providerId;
      
      const updateData: any = {
        updatedAt: Timestamp.now()
      };
      
      // Mark the appropriate field based on who is completing
      if (isProvider) {
        updateData.providerMarkedComplete = true;
      } else {
        updateData.receiverMarkedComplete = true;
      }
      
      // Check if both parties have marked complete
      const bothMarkedComplete = 
        (isProvider && swapData.receiverMarkedComplete) || 
        (!isProvider && swapData.providerMarkedComplete);
      
      if (bothMarkedComplete) {
        updateData.status = 'completed';
      }
      
      await updateDoc(swapRef, updateData);
      
      // Update the local state
      setSwaps(swaps.map(swap => {
        if (swap.id === swapId) {
          const updatedSwap = {
            ...swap,
            updatedAt: new Date()
          };
          
          if (isProvider) {
            updatedSwap.providerMarkedComplete = true;
          } else {
            updatedSwap.receiverMarkedComplete = true;
          }
          
          if (bothMarkedComplete) {
            updatedSwap.status = 'completed';
          }
          
          return updatedSwap;
        }
        return swap;
      }));
    } catch (error) {
      console.error('Error marking swap as complete:', error);
    }
  };

  const getStatusBadgeColor = (status: SwapStatus) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'accepted':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'declined':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper function to get the other user's ID
  const getOtherUserId = (swap: Swap) => {
    if (!user) return '';
    if (user.uid === swap.providerId) return swap.receiverId;
    if (user.uid === swap.receiverId) return swap.providerId;
    return '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Swaps</h1>
        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          Find New Swaps
        </Link>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-6 px-4 sm:px-6">
            <button
              onClick={() => setActiveTab('all')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'all'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Swaps
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setActiveTab('active')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'completed'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Completed
            </button>
          </nav>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : (filteredSwaps.length > 0) ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Swap Details
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSwaps.map((swap) => (
                  <tr key={swap.id}>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 flex-1">
                          <div className="font-semibold mb-1">
                            {swap.providerService} ↔ {swap.receiverService}
                          </div>
                          <div className="text-xs text-gray-500">
                            With: {user?.uid === swap.providerId ? swap.receiverName : swap.providerName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeColor(swap.status)}`}>
                        {swap.status.charAt(0).toUpperCase() + swap.status.slice(1)}
                      </span>
                      {swap.status === 'accepted' && (
                        <div className="mt-1 flex items-center gap-1 text-xs">
                          <span className={`h-2 w-2 rounded-full ${swap.providerMarkedComplete ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className={`h-2 w-2 rounded-full ${swap.receiverMarkedComplete ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                          <span className="ml-1 text-gray-500">
                            {(swap.providerMarkedComplete && swap.receiverMarkedComplete) ? 'Both marked' : 
                             (swap.providerMarkedComplete || swap.receiverMarkedComplete) ? '1/2 marked' : ''}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {swap.createdAt.toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/dashboard/inbox?swapId=${swap.id}`}
                        className="text-indigo-600 hover:text-indigo-900 mr-3"
                      >
                        View
                      </Link>
                      {swap.status === 'pending' && user?.uid === swap.receiverId && (
                        <>
                          <button
                            onClick={() => handleAcceptSwap(swap.id)}
                            className="text-green-600 hover:text-green-900 mr-3"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleDeclineSwap(swap.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {swap.status === 'accepted' && (
                        <>
                          {((user?.uid === swap.providerId && !swap.providerMarkedComplete) || 
                            (user?.uid === swap.receiverId && !swap.receiverMarkedComplete)) && (
                        <button
                              onClick={() => handleMarkComplete(swap.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Mark Complete
                        </button>
                          )}
                          {((user?.uid === swap.providerId && swap.providerMarkedComplete) || 
                            (user?.uid === swap.receiverId && swap.receiverMarkedComplete)) && (
                            <span className="text-gray-500">
                              Waiting for completion
                            </span>
                          )}
                        </>
                      )}
                      {swap.status === 'completed' && (
                        <Link
                          href={`/profile/${getOtherUserId(swap)}?endorse=true&swapId=${swap.id}`}
                          className="text-purple-600 hover:text-purple-900 ml-3"
                        >
                          Endorse
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-10 px-4 sm:px-6 text-center">
            <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-gray-400"
              >
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">No swaps found</h3>
            <p className="mt-2 text-gray-500 max-w-md mx-auto">
              {activeTab === 'all' 
                ? "You haven't participated in any service swaps yet." 
                : `You don't have any ${activeTab} swaps.`}
            </p>
            <div className="mt-6">
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Explore the Marketplace
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 