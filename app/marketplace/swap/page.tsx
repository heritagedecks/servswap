'use client';

export const dynamic = "force-dynamic";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/app/context/AuthContext';
import { db } from '@/app/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { z } from 'zod';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createSwapRequestNotification } from '@/app/lib/swapNotifications';

interface Service {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  title: string;
  description: string;
  category: string;
  location: string;
  images: string[];
}

const swapSchema = z.object({
  message: z.string().min(20, { message: 'Message must be at least 20 characters long' }).max(500, { message: 'Message cannot exceed 500 characters' }),
  offeredServiceId: z.string().min(1, { message: 'Please select one of your services to offer' }),
});

type SwapFormValues = z.infer<typeof swapSchema>;

function SwapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const serviceId = searchParams?.get('serviceId');
  const { user } = useAuth();
  
  const [targetService, setTargetService] = useState<Service | null>(null);
  const [userServices, setUserServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SwapFormValues>({
    resolver: zodResolver(swapSchema),
    defaultValues: {
      message: '',
      offeredServiceId: '',
    },
  });
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      if (!user) {
        router.push('/auth/login');
        return;
      }
      
      if (!serviceId) {
        setError('No service selected for swapping');
        setIsLoading(false);
        return;
      }
      
      try {
        // Fetch the target service details
        const serviceDocRef = doc(db, 'services', serviceId);
        const serviceDoc = await getDoc(serviceDocRef);
        
        if (!serviceDoc.exists()) {
          setError('Service not found');
          setIsLoading(false);
          return;
        }
        
        const serviceData = serviceDoc.data();
        
        if (serviceData.userId === user.uid) {
          setError('You cannot swap with your own service');
          setIsLoading(false);
          return;
        }
        
        // Get owner details if needed
        let userName = serviceData.userName || 'Unknown User';
        let userAvatar = serviceData.userAvatar || '';
        
        if (serviceData.userId) {
          try {
            const userDocRef = doc(db, 'users', serviceData.userId);
            const userDoc = await getDoc(userDocRef);
            if (userDoc.exists()) {
              const userData = userDoc.data();
              userName = userData.displayName || userName;
              userAvatar = userData.photoURL || userAvatar;
            }
          } catch (err) {
            console.error('Error fetching user data:', err);
          }
        }
        
        setTargetService({
          id: serviceDoc.id,
          userId: serviceData.userId,
          userName: userName,
          userAvatar: userAvatar,
          title: serviceData.title,
          description: serviceData.description,
          category: serviceData.category,
          location: serviceData.location || 'Remote',
          images: serviceData.images || [],
        });
        
        // Fetch the current user's services
        const userServicesQuery = query(
          collection(db, 'services'),
          where('userId', '==', user.uid),
          where('isActive', '==', true)
        );
        
        const userServicesSnapshot = await getDocs(userServicesQuery);
        const userServicesData: Service[] = [];
        
        userServicesSnapshot.forEach((doc) => {
          const data = doc.data();
          userServicesData.push({
            id: doc.id,
            userId: user.uid,
            userName: user.displayName || 'Anonymous User',
            userAvatar: user.photoURL || '',
            title: data.title,
            description: data.description,
            category: data.category,
            location: data.location || 'Remote',
            images: data.images || [],
          });
        });
        
        setUserServices(userServicesData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load necessary data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [serviceId, user, router]);
  
  const onSubmit: SubmitHandler<SwapFormValues> = async (data) => {
    if (!user || !targetService) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const selectedService = userServices.find(service => service.id === data.offeredServiceId);
      
      if (!selectedService) {
        setError('Selected service not found');
        setIsSubmitting(false);
        return;
      }
      
      // Create a new swap proposal in Firestore
      const swapData = {
        providerId: user.uid,
        providerName: user.displayName || 'Anonymous User',
        providerService: selectedService.title,
        providerServiceId: selectedService.id,
        receiverId: targetService.userId,
        receiverName: targetService.userName,
        receiverService: targetService.title,
        receiverServiceId: targetService.id,
        status: 'pending', // pending, accepted, completed, declined, cancelled
        message: data.message,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        read: false
      };
      
      // Add to swaps collection
      const swapRef = await addDoc(collection(db, 'swaps'), swapData);
      
      // Create a notification for the recipient
      await createSwapRequestNotification(
        swapRef.id,
        user.uid,
        targetService.userId,
        targetService.title
      );
      
      // Create a message in the conversation
      await addDoc(collection(db, 'swapMessages'), {
        swapId: swapRef.id,
        senderId: user.uid,
        senderName: user.displayName || 'User',
        text: `I'd like to swap my "${selectedService.title}" service for your "${targetService.title}" service.`,
        timestamp: serverTimestamp(),
        read: false
      });
      
      // Redirect to the inbox with success message
      router.push('/dashboard/inbox');
    } catch (err) {
      console.error('Error creating swap:', err);
      setError('Failed to create swap request. Please try again.');
      setIsSubmitting(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }
  
  if (error || !targetService) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center bg-white p-8 rounded-lg shadow-md max-w-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error || 'Something went wrong'}</p>
          <Link href="/marketplace" className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Marketplace
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <Link 
            href="/marketplace" 
            className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Marketplace
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Initiate Service Swap</h1>
          <p className="text-gray-600 mt-2">
            Propose a swap with {targetService.userName} for their "{targetService.title}" service
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Left column: Target service details */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
              <div className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Service You're Requesting</h2>
                
                {targetService.images && targetService.images.length > 0 && (
                  <div className="h-48 -mx-6 -mt-6 mb-6 overflow-hidden">
                    <Image 
                      src={targetService.images[0]} 
                      alt={targetService.title}
                      width={400}
                      height={200}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                
                <div className="flex items-center mb-4">
                  <Link 
                    href={`/profile/${targetService.userId}`}
                    className="h-10 w-10 rounded-full overflow-hidden mr-3 border-2 border-indigo-100 hover:border-indigo-300 transition-colors"
                  >
                    {targetService.userAvatar ? (
                      <Image 
                        src={targetService.userAvatar} 
                        alt={targetService.userName}
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                        <span className="text-white text-sm font-medium">{targetService.userName.charAt(0)}</span>
                      </div>
                    )}
                  </Link>
                  <div>
                    <Link 
                      href={`/profile/${targetService.userId}`}
                      className="text-sm font-medium text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {targetService.userName}
                    </Link>
                    <p className="text-xs text-gray-500">{targetService.location}</p>
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{targetService.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{targetService.description}</p>
                
                <div className="flex items-center text-sm text-gray-500">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 mr-2">
                    {targetService.category}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right column: Swap form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Your Swap Proposal</h2>
              
              {userServices.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">You don't have any services yet</h3>
                  <p className="text-gray-600 mb-4">Create a service first to be able to offer it for swapping</p>
                  <Link
                    href="/dashboard/services/new"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    Create a Service
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <label htmlFor="offeredServiceId" className="block text-sm font-medium text-gray-700 mb-1">
                      Select a service to offer
                    </label>
                    <select
                      id="offeredServiceId"
                      {...register('offeredServiceId')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white"
                    >
                      <option value="">Choose one of your services</option>
                      {userServices.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.title}
                        </option>
                      ))}
                    </select>
                    {errors.offeredServiceId && (
                      <p className="mt-1 text-sm text-red-600">{errors.offeredServiceId.message}</p>
                    )}
                  </div>
                  
                  <div>
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">
                      Message to {targetService.userName.split(' ')[0]}
                    </label>
                    <textarea
                      id="message"
                      {...register('message')}
                      rows={5}
                      placeholder={`Hello ${targetService.userName.split(' ')[0]}, I'm interested in your service. I'd like to swap my service for yours...`}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    ></textarea>
                    {errors.message && (
                      <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
                    )}
                  </div>
                  
                  <div className="bg-gray-50 p-4 -mx-6 -mb-6 rounded-b-xl border-t border-gray-100 flex justify-end space-x-3">
                    <Link
                      href="/marketplace"
                      className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Sending Proposal...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                          Send Swap Proposal
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SwapPage() {
  return (
    <Suspense>
      <SwapPageInner />
    </Suspense>
  );
} 