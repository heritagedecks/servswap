'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, orderBy, limit, getDoc, doc } from 'firebase/firestore';
import { PiggyBank as LucidePiggyBank, X } from 'lucide-react';

// Mock data for dashboard demonstration
// const RECENT_SWAPS = [
//   {
//     id: '1',
//     service: 'Website Design',
//     status: 'COMPLETED',
//     with: 'Jane Smith',
//     date: '2023-08-15',
//   },
//   {
//     id: '2',
//     service: 'Logo Creation',
//     status: 'PENDING',
//     with: 'John Doe',
//     date: '2023-08-12',
//   },
//   {
//     id: '3',
//     service: 'Social Media Management',
//     status: 'ACCEPTED',
//     with: 'Alex Johnson',
//     date: '2023-08-10',
//   },
// ];

// const MY_SERVICES = [
//   {
//     id: '1',
//     title: 'Web Development',
//     category: 'Technology',
//     isActive: true,
//   },
//   {
//     id: '2',
//     title: 'Logo Design',
//     category: 'Design',
//     isActive: true,
//   },
//   {
//     id: '3',
//     title: 'Content Writing',
//     category: 'Writing',
//     isActive: false,
//   },
// ];

// Add interfaces for dashboard rows
interface DashboardSwapRow {
  id: string;
  service: string;
  status: string;
  with: string;
  date: string;
  providerId?: string;
  receiverId?: string;
}
interface DashboardServiceRow {
  id: string;
  title: string;
  category: string;
  isActive: boolean;
}

// Status badge component
const StatusBadge = ({ status }: { status: string }) => {
  const statusStyles = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    ACCEPTED: 'bg-blue-100 text-blue-800',
    COMPLETED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
  };

  // @ts-ignore
  const badgeStyle = statusStyles[status] || 'bg-gray-100 text-gray-800';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeStyle}`}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
};

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    activeServices: 0,
    completedSwaps: 0,
    pendingSwaps: 0,
    totalValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentSwaps, setRecentSwaps] = useState<DashboardSwapRow[]>([]);
  const [myServices, setMyServices] = useState<DashboardServiceRow[]>([]);
  const [showSavingsModal, setShowSavingsModal] = useState(false);
  const [savingsDetails, setSavingsDetails] = useState<{ id: string, service: string, with: string, value: number, date: string, direction: string }[]>([]);
  const [loadingSavings, setLoadingSavings] = useState(false);

  useEffect(() => {
    const fetchDashboardStats = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Count active services
        const servicesQuery = query(
          collection(db, 'services'),
          where('userId', '==', user.uid),
          where('isActive', '==', true)
        );
        const servicesSnapshot = await getDocs(servicesQuery);
        const activeServicesCount = servicesSnapshot.size;
        
        // Count completed swaps
        const completedSwapsQuery1 = query(
          collection(db, 'swaps'),
          where('providerId', '==', user.uid),
          where('status', '==', 'completed')
        );
        const completedSwapsQuery2 = query(
          collection(db, 'swaps'),
          where('receiverId', '==', user.uid),
          where('status', '==', 'completed')
        );
        const [completedSnapshot1, completedSnapshot2] = await Promise.all([
          getDocs(completedSwapsQuery1),
          getDocs(completedSwapsQuery2)
        ]);
        
        // Create a set to deduplicate any potential overlaps
        const completedSwapIds = new Set([
          ...completedSnapshot1.docs.map(doc => doc.id),
          ...completedSnapshot2.docs.map(doc => doc.id)
        ]);
        const completedSwapsCount = completedSwapIds.size;
        
        // Count pending swaps
        const pendingSwapsQuery1 = query(
          collection(db, 'swaps'),
          where('providerId', '==', user.uid),
          where('status', '==', 'pending')
        );
        const pendingSwapsQuery2 = query(
          collection(db, 'swaps'),
          where('receiverId', '==', user.uid),
          where('status', '==', 'pending')
        );
        const [pendingSnapshot1, pendingSnapshot2] = await Promise.all([
          getDocs(pendingSwapsQuery1),
          getDocs(pendingSwapsQuery2)
        ]);
        
        // Create a set to deduplicate any potential overlaps
        const pendingSwapIds = new Set([
          ...pendingSnapshot1.docs.map(doc => doc.id),
          ...pendingSnapshot2.docs.map(doc => doc.id)
        ]);
        const pendingSwapsCount = pendingSwapIds.size;
        
        // Fetch user's services (for table only)
        const allServicesQuery = query(
          collection(db, 'services'),
          where('userId', '==', user.uid)
        );
        const allServicesSnapshot = await getDocs(allServicesQuery);
        const services = allServicesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title,
            category: data.category,
            isActive: data.isActive,
          };
        });
        setMyServices(services);
        
        // Calculate $ Saved Swapping: sum valueEstimate of services received in completed swaps
        let totalValue = 0;
        
        // When user is receiver, we need to get the provider's service (providerServiceId)
        // When user is provider, we get the receiver's service (receiverServiceId)
        const receiverSwaps = completedSnapshot2.docs;  // User is receiver
        const providerSwaps = completedSnapshot1.docs;  // User is provider
        
        console.log(`User ${user.uid} has ${receiverSwaps.length} as receiver and ${providerSwaps.length} as provider`);
        
        // First, process swaps where user is receiver (gets services from provider)
        if (receiverSwaps.length > 0) {
          console.log(`Found ${receiverSwaps.length} completed swaps as receiver`);
        
          // For each swap, fetch the service and sum its valueEstimate
          const valuePromises = receiverSwaps.map(async swapDoc => {
            const swapData = swapDoc.data();
            console.log(`Processing receiver swap ${swapDoc.id}`);
            
            // As receiver, we get provider's service
            const serviceId = swapData.providerServiceId;
            if (!serviceId) {
              console.log(`No providerServiceId found for swap ${swapDoc.id}`);
              return 0;
            }
            
            try {
              const serviceDoc = await getDoc(doc(db, 'services', serviceId));
              if (serviceDoc.exists()) {
                const serviceData = serviceDoc.data();
                const valueEstimate = serviceData.valueEstimate;
                
                console.log(`Service ${serviceId} value estimate:`, valueEstimate);
                
                if (typeof valueEstimate === 'number') {
                  return valueEstimate;
                } else {
                  console.log(`Invalid value estimate for service ${serviceId}:`, valueEstimate);
                  return 0;
                }
              } else {
                console.log(`Service ${serviceId} not found`);
              }
            } catch (error) {
              console.error(`Error fetching service ${serviceId} value:`, error);
            }
            return 0;
          });
          
          const values = await Promise.all(valuePromises);
          console.log('Receiver swap value estimates:', values);
          totalValue += values.reduce((sum, v) => sum + v, 0);
        }
        
        console.log('Savings after processing received services:', totalValue);
          
        // Now process swaps where user is provider
        // A swap is two-way - if you provide a service, you also receive a service in return
        // The value you receive is represented by the receiver's service
        if (providerSwaps.length > 0) {
          console.log(`Found ${providerSwaps.length} completed swaps as provider`);
          
          // For each swap, fetch the receiver's service value estimate
          const valuePromises = providerSwaps.map(async swapDoc => {
            const swapData = swapDoc.data();
            console.log(`Processing provider swap ${swapDoc.id}`);
            
            // As provider, we received the receiver's service
            const serviceId = swapData.receiverServiceId;
            if (!serviceId) {
              console.log(`No receiverServiceId found for swap ${swapDoc.id}`);
              return 0;
            }
            
            try {
              const serviceDoc = await getDoc(doc(db, 'services', serviceId));
              if (serviceDoc.exists()) {
                const serviceData = serviceDoc.data();
                const valueEstimate = serviceData.valueEstimate;
                
                console.log(`Receiver's service ${serviceId} value estimate:`, valueEstimate);
                
                if (typeof valueEstimate === 'number') {
                  return valueEstimate;
                } else {
                  console.log(`Invalid value estimate for service ${serviceId}:`, valueEstimate);
                  return 0;
                }
              } else {
                console.log(`Service ${serviceId} not found`);
              }
            } catch (error) {
              console.error(`Error fetching service ${serviceId} value:`, error);
            }
            return 0;
          });
          
          const values = await Promise.all(valuePromises);
          console.log('Provider swap value estimates (services received in exchange):', values);
          totalValue += values.reduce((sum, v) => sum + v, 0);
            }
        
        console.log('Total savings after processing both directions:', totalValue);
        
        // Update the stats
        setStats({
          activeServices: activeServicesCount,
          completedSwaps: completedSwapsCount,
          pendingSwaps: pendingSwapsCount,
          totalValue,
        });
        
        // Fetch recent swaps (limit 5, most recent, as provider or receiver)
        const recentSwapsQuery1 = query(
          collection(db, 'swaps'),
          where('providerId', '==', user.uid),
          orderBy('updatedAt', 'desc'),
          limit(5)
        );
        const recentSwapsQuery2 = query(
          collection(db, 'swaps'),
          where('receiverId', '==', user.uid),
          orderBy('updatedAt', 'desc'),
          limit(5)
        );
        const [recent1, recent2] = await Promise.all([
          getDocs(recentSwapsQuery1),
          getDocs(recentSwapsQuery2)
        ]);
        // Merge, dedupe, and sort
        const allRecent = [...recent1.docs, ...recent2.docs];
        const uniqueSwaps = Array.from(new Map(allRecent.map(doc => [doc.id, doc])).values());
        uniqueSwaps.sort((a, b) => b.data().updatedAt?.toDate() - a.data().updatedAt?.toDate());
        // For each swap, get the other user's name
        const swapsWithNames = await Promise.all(uniqueSwaps.slice(0, 5).map(async doc => {
          const data = doc.data();
          const isProvider = data.providerId === user.uid;
          const otherUserId = isProvider ? data.receiverId : data.providerId;
          let otherUserName = 'Unknown';
          try {
            const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', otherUserId)));
            if (!userDoc.empty) {
              otherUserName = userDoc.docs[0].data().displayName || 'User';
            }
          } catch {}
          return {
            id: doc.id,
            service: data.message || data.serviceTitle || 'Swap',
            status: (data.status || '').toUpperCase(),
            with: otherUserName,
            date: data.updatedAt?.toDate().toLocaleDateString() || '',
            providerId: data.providerId,
            receiverId: data.receiverId,
          };
        }));
        setRecentSwaps(swapsWithNames);
      } catch (error) {
        console.error('Error fetching dashboard stats:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardStats();
  }, [user]);

  // Fetch detailed savings information for the modal
  const fetchSavingsDetails = async () => {
    if (!user) return;
    
    try {
      setLoadingSavings(true);
      
      // Get swaps where user is the receiver
      const receivedSwapsQuery = query(
        collection(db, 'swaps'),
        where('receiverId', '==', user.uid),
        where('status', '==', 'completed'),
        orderBy('updatedAt', 'desc')
      );
      
      // Get swaps where user is the provider
      const providedSwapsQuery = query(
        collection(db, 'swaps'),
        where('providerId', '==', user.uid),
        where('status', '==', 'completed'),
        orderBy('updatedAt', 'desc')
      );
      
      // Fetch both types of swaps
      const [receivedSwapsSnapshot, providedSwapsSnapshot] = await Promise.all([
        getDocs(receivedSwapsQuery),
        getDocs(providedSwapsQuery)
      ]);
      
      const receivedSwaps = receivedSwapsSnapshot.docs;
      const providedSwaps = providedSwapsSnapshot.docs;
      
      console.log(`User ${user.uid} has ${receivedSwaps.length} swaps as receiver and ${providedSwaps.length} as provider for savings modal`);
      
      // If we have provided swaps but no received swaps, let's debug what's happening
      if (providedSwaps.length > 0 && receivedSwaps.length === 0) {
        console.log("User has provided swaps but no received swaps - debugging provided swaps:");
        providedSwaps.forEach((doc, index) => {
          const data = doc.data();
          console.log(`Provided swap ${index+1}:`, {
            id: doc.id,
            status: data.status,
            providerId: data.providerId,
            receiverId: data.receiverId,
            providerServiceId: data.providerServiceId,
            receiverServiceId: data.receiverServiceId,
            createdAt: data.createdAt?.toDate()?.toISOString(),
            updatedAt: data.updatedAt?.toDate()?.toISOString()
          });
        });
      }
      
      // For each swap, get the service details and calculate savings
      // First process swaps where user is receiver (received services)
      const receiverSavingsPromises = receivedSwaps.map(async swapDoc => {
        const swapData = swapDoc.data();
        console.log(`Processing receiver swap ${swapDoc.id} for savings details`);
        
        // As receiver, we get the provider's service
        const serviceId = swapData.providerServiceId;
        
        if (!serviceId) {
          console.log(`No providerServiceId found for swap ${swapDoc.id}`);
          return null;
        }
        
        try {
          // Get service details to get value estimate
          const serviceDoc = await getDoc(doc(db, 'services', serviceId));
          if (serviceDoc.exists()) {
            const serviceData = serviceDoc.data();
            
            const valueEstimate = typeof serviceData.valueEstimate === 'number' 
              ? serviceData.valueEstimate 
              : 0;
            
            console.log(`Service ${serviceId} value estimate: ${valueEstimate}`);
            
            const serviceName = swapData.providerService || serviceData.title || 'Unknown Service';
            const providerName = swapData.providerName || 'Unknown Provider';
            
            return {
              id: swapDoc.id,
              service: serviceName,
              with: providerName,
              value: valueEstimate,
              date: swapData.updatedAt?.toDate().toLocaleDateString() || 'Unknown Date',
              direction: 'Received'
            };
          } else {
            console.log(`Service ${serviceId} not found in database`);
          }
        } catch (error) {
          console.error(`Error getting service details for savings for service ${serviceId}:`, error);
        }
        
        return null;
      });

      // Process swaps where user is provider (services received in exchange)
      const providerSavingsPromises = providedSwaps.map(async swapDoc => {
        const swapData = swapDoc.data();
        console.log(`Processing provider swap ${swapDoc.id} for savings details`);
        
        // As provider, we received the receiver's service
        const serviceId = swapData.receiverServiceId;
        
        if (!serviceId) {
          console.log(`No receiverServiceId found for swap ${swapDoc.id}`);
          return null;
        }
        
        try {
          // Get service details to get value estimate
          const serviceDoc = await getDoc(doc(db, 'services', serviceId));
          if (serviceDoc.exists()) {
            const serviceData = serviceDoc.data();
            
            const valueEstimate = typeof serviceData.valueEstimate === 'number' 
              ? serviceData.valueEstimate 
              : 0;
            
            console.log(`Service ${serviceId} value estimate: ${valueEstimate}`);
            
            const serviceName = swapData.receiverService || serviceData.title || 'Unknown Service';
            const receiverName = swapData.receiverName || 'Unknown Receiver';
            
            return {
              id: swapDoc.id,
              service: serviceName,
              with: receiverName,
              value: valueEstimate,
              date: swapData.updatedAt?.toDate().toLocaleDateString() || 'Unknown Date',
              direction: 'Exchanged'
            };
          } else {
            console.log(`Service ${serviceId} not found in database`);
          }
        } catch (error) {
          console.error(`Error getting service details for savings for service ${serviceId}:`, error);
        }
        
        return null;
      });
      
      // Combine both types of swaps
      const allSavingsPromises = [...receiverSavingsPromises, ...providerSavingsPromises];
      
      const savingsDetailsResults = await Promise.all(allSavingsPromises);
      const validSavingsDetails = savingsDetailsResults.filter(item => item !== null) as { 
        id: string, 
        service: string, 
        with: string, 
        value: number, 
        date: string,
        direction: string
      }[];
      
      // Sort by date (newest first)
      validSavingsDetails.sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
      
      setSavingsDetails(validSavingsDetails);
    } catch (error) {
      console.error('Error fetching savings details:', error);
    } finally {
      setLoadingSavings(false);
    }
  };
  
  // Load savings details when modal is opened
  useEffect(() => {
    if (showSavingsModal) {
      fetchSavingsDetails();
    }
  }, [showSavingsModal]);

  // Add this helper function near the top, after user is defined
  function getOtherUserId(swap: any) {
    if (!user) return '';
    if (user.uid === swap.providerId) return swap.receiverId;
    if (user.uid === swap.receiverId) return swap.providerId;
    return '';
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <Link
          href="/dashboard/services/new"
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
          Add New Service
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/services" className="rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow hover:bg-gray-50">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
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
                className="h-6 w-6"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Active Services</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? (
                  <span className="h-8 w-8 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin inline-block"></span>
                ) : (
                  stats.activeServices
                )}
              </p>
            </div>
          </div>
        </Link>
        <Link href="/dashboard/swaps?tab=completed" className="rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow hover:bg-gray-50">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center text-green-600">
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
                className="h-6 w-6"
              >
                <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Completed Swaps</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? (
                  <span className="h-8 w-8 rounded-full border-2 border-green-200 border-t-green-600 animate-spin inline-block"></span>
                ) : (
                  stats.completedSwaps
                )}
              </p>
            </div>
          </div>
        </Link>
        <Link href="/dashboard/swaps?tab=pending" className="rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow hover:bg-gray-50">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
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
                className="h-6 w-6"
              >
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Pending Swaps</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? (
                  <span className="h-8 w-8 rounded-full border-2 border-yellow-200 border-t-yellow-600 animate-spin inline-block"></span>
                ) : (
                  stats.pendingSwaps
                )}
              </p>
            </div>
          </div>
        </Link>
        <button 
          onClick={() => setShowSavingsModal(true)} 
          className="rounded-lg border bg-white p-4 shadow-sm transition-all hover:shadow hover:bg-gray-50 text-left"
        >
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
              <LucidePiggyBank className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">$ Saved Swapping</h3>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? (
                  <span className="h-8 w-8 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin inline-block"></span>
                ) : (
                  `$${stats.totalValue.toLocaleString()}`
                )}
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Recent Swaps */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">Recent Swaps</h2>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  With
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentSwaps.slice(0, 3).map((swap) => (
                <tr key={swap.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {swap.service}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <StatusBadge status={swap.status} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {swap.with}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {swap.date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    <Link
                      href={`/dashboard/inbox?swapId=${swap.id}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      View
                    </Link>
                    {swap.status === 'COMPLETED' && (
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
        <div className="p-4 border-t">
          <Link 
            href="/dashboard/swaps" 
            className="text-sm text-indigo-600 hover:text-indigo-900 font-medium flex items-center gap-1"
          >
            View all swaps
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
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      </div>

      {/* My Services */}
      <div className="rounded-lg border bg-white shadow-sm">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg">My Services</h2>
        </div>
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {myServices.slice(0, 3).map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {service.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {service.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      service.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {service.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                    <Link
                      href={`/dashboard/services/${service.id}/edit`}
                      className="text-indigo-600 hover:text-indigo-900 mr-4"
                    >
                      Edit
                    </Link>
                    <button className="text-red-600 hover:text-red-900">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t">
          <Link 
            href="/dashboard/services" 
            className="text-sm text-indigo-600 hover:text-indigo-900 font-medium flex items-center gap-1"
          >
            View all services
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
              <path d="m9 18 6-6-6-6" />
            </svg>
          </Link>
        </div>
      </div>
      
      {/* Savings Modal */}
      {showSavingsModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold flex items-center">
                  <LucidePiggyBank className="h-5 w-5 mr-2" />
                  Money Saved Through Service Swaps
                </h3>
                <button onClick={() => setShowSavingsModal(false)} className="p-1 hover:bg-white hover:bg-opacity-10 rounded">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-1 text-indigo-100 text-sm">
                These are the estimated market values of services you've received through completed swaps.
              </p>
            </div>
            
            {/* Modal Body */}
            <div className="overflow-y-auto max-h-[70vh] overflow-x-auto -mx-4 sm:mx-0">
              {loadingSavings ? (
                <div className="p-10 flex justify-center">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
                </div>
              ) : savingsDetails.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Service
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        With
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {savingsDetails.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {item.service}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.with}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.date}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.direction === 'Received' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.direction}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                          ${item.value.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                        Total Savings:
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-bold">
                        ${savingsDetails.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="p-8 text-center">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="mt-4 text-gray-500">
                    No completed service swaps found. When you receive services through swaps, their estimated market value will appear here.
                  </p>
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowSavingsModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 