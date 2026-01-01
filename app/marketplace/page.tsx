'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { db } from '@/app/lib/firebase';
import { collection, query, getDocs, limit, startAfter, orderBy, where, doc, getDoc, DocumentData, QueryDocumentSnapshot } from 'firebase/firestore';
import Footer from '../components/Footer';
import { Pencil, BadgeCheck, CheckCircle } from "lucide-react";

interface ServiceListing {
  id: string;
  userId: string;
  userName: string;
  title: string;
  description: string;
  category: string;
  location: string;
  createdAt: Date;
  userAvatar?: string;
  servicesWanted?: string[];
}

interface VerificationBadgeProps {
  userId: string;
  className?: string;
}

export default function MarketplacePage() {
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedService, setSelectedService] = useState<ServiceListing | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  const categories = [
    'Technology',
    'Design',
    'Marketing',
    'Writing',
    'Business',
    'Lifestyle',
    'Education',
    'Health',
    'Entertainment',
    'Other'
  ];

  // Define fetchServices with useCallback to prevent unnecessary re-renders
  const fetchServices = useCallback(async (searchAfter: QueryDocumentSnapshot<DocumentData> | null = null) => {
    setIsLoading(true);
    try {
      let servicesQuery;
      
      if (selectedCategory) {
        servicesQuery = query(
          collection(db, 'services'),
          where('category', '==', selectedCategory),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
      } else {
        servicesQuery = query(
          collection(db, 'services'),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
      }
      
      if (searchAfter) {
        servicesQuery = query(
          collection(db, 'services'),
          ...(selectedCategory ? [where('category', '==', selectedCategory)] : []),
          orderBy('createdAt', 'desc'),
          startAfter(searchAfter),
          limit(10)
        );
      }
      
      const snapshot = await getDocs(servicesQuery);
      
      if (snapshot.empty) {
        setHasMore(false);
        setIsLoading(false);
        return;
      }
      
      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisible(lastDoc);
      
      const servicesData: ServiceListing[] = [];
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        
        // Fetch user info to get name and avatar
        let userName = data.userName || 'Unknown User';
        let userAvatar = data.userAvatar || '';
        
        if (data.userId) {
          try {
            const userDocRef = doc(db, 'users', data.userId);
            const userDocSnapshot = await getDoc(userDocRef);
            if (userDocSnapshot.exists()) {
              const userData = userDocSnapshot.data() as { displayName?: string; photoURL?: string };
              userName = userData.displayName || userName;
              userAvatar = userData.photoURL || userAvatar;
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          }
        }
        
        servicesData.push({
          id: docSnapshot.id,
          userId: data.userId,
          userName: userName,
          title: data.title,
          description: data.description,
          category: data.category,
          location: data.location || 'Remote',
          createdAt: data.createdAt?.toDate() || new Date(),
          userAvatar: userAvatar,
          servicesWanted: data.servicesWanted || [],
        });
      }
      
      setServices(prev => searchAfter ? [...prev, ...servicesData] : servicesData);
      setHasMore(snapshot.docs.length === 10);
    } catch (error) {
      console.error('Error fetching services:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory]);

  useEffect(() => {
    if (!user) return; // Only fetch if logged in
    fetchServices();
  }, [fetchServices, user]);

  const handleLoadMore = () => {
    if (lastVisible) {
      fetchServices(lastVisible);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality here
    // This would require a more complex query or server-side search
    console.log('Searching for:', searchTerm);
  };

  const handleInitiateSwap = (serviceId: string) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    
    router.push(`/marketplace/swap?serviceId=${serviceId}`);
  };

  // Mock data for development
  const mockServices: ServiceListing[] = [
    {
      id: '1',
      userId: '123',
      userName: 'Alex Morgan',
      title: 'Professional Web Development',
      description: 'Full-stack web development services using React, Node.js, and MongoDB. I can build responsive and dynamic web applications tailored to your needs.',
      category: 'Technology',
      location: 'Remote',
      createdAt: new Date('2023-10-10'),
      userAvatar: 'https://randomuser.me/api/portraits/men/1.jpg'
    },
    {
      id: '2',
      userId: '456',
      userName: 'Jessica Chen',
      title: 'Graphic Design and Branding',
      description: 'Creative graphic design services including logo design, branding materials, social media graphics, and more. Let me help you build a cohesive brand identity.',
      category: 'Design',
      location: 'Remote',
      createdAt: new Date('2023-10-08'),
      userAvatar: 'https://randomuser.me/api/portraits/women/2.jpg'
    },
    {
      id: '3',
      userId: '789',
      userName: 'Marcus Johnson',
      title: 'Social Media Marketing Strategy',
      description: 'I can help you develop and implement a comprehensive social media marketing strategy to grow your audience and increase engagement across platforms.',
      category: 'Marketing',
      location: 'Remote',
      createdAt: new Date('2023-10-05'),
      userAvatar: 'https://randomuser.me/api/portraits/men/3.jpg'
    },
    {
      id: '4',
      userId: '101',
      userName: 'Sophie Williams',
      title: 'Content Writing and Copywriting',
      description: 'Professional content writing services for blogs, websites, and marketing materials. SEO-optimized content that engages readers and drives conversions.',
      category: 'Writing',
      location: 'Remote',
      createdAt: new Date('2023-10-03'),
      userAvatar: 'https://randomuser.me/api/portraits/women/4.jpg'
    },
    {
      id: '5',
      userId: '102',
      userName: 'David Lopez',
      title: 'Financial Planning and Consulting',
      description: 'Personalized financial planning and consulting services. I can help you create a budget, plan for retirement, or develop investment strategies.',
      category: 'Business',
      location: 'Remote',
      createdAt: new Date('2023-09-30'),
      userAvatar: 'https://randomuser.me/api/portraits/men/5.jpg'
    }
  ];

  const displayServices = services.length > 0 ? services : mockServices;
  const filteredServices = displayServices.filter(service => 
    (searchTerm === '' || 
     service.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
     service.description.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedCategory === '' || service.category === selectedCategory)
  );

  const getCategoryColor = (category: string) => {
    const categoryColors: {[key: string]: string} = {
      'Technology': 'bg-blue-100 text-blue-800',
      'Design': 'bg-purple-100 text-purple-800',
      'Marketing': 'bg-green-100 text-green-800',
      'Writing': 'bg-yellow-100 text-yellow-800',
      'Business': 'bg-gray-100 text-gray-800',
      'Lifestyle': 'bg-pink-100 text-pink-800',
      'Education': 'bg-indigo-100 text-indigo-800',
      'Health': 'bg-teal-100 text-teal-800',
      'Entertainment': 'bg-red-100 text-red-800',
      'Other': 'bg-orange-100 text-orange-800'
    };
    
    return categoryColors[category] || 'bg-indigo-100 text-indigo-800';
  };

  // Add the VerificationBadge component
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

  if (!user) {
    // Not logged in: show only hero/header and a CTA
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Hero section (copied from main render) */}
        <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-16 overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{ 
              backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
              backgroundSize: '20px 20px'
            }}></div>
          </div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
            <div className="md:flex md:items-center md:justify-between">
              <div className="md:w-3/5">
                <h1 className="text-4xl font-extrabold tracking-tight mb-2 md:text-5xl">
                  The Marketplace for <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-yellow-200 drop-shadow-sm">Service Swapping</span>
                </h1>
                <p className="mt-4 text-lg text-indigo-100 max-w-2xl leading-relaxed">
                  Find and exchange services based on your skills and talents. 
                  <span className="hidden md:inline"> No money needed — create value through collaboration and community.</span>
                </p>
              </div>
              {/* Always show Back to Homepage button */}
              <div className="mt-8 md:mt-0 md:w-2/5 flex justify-end space-x-3">
                <Link
                  href="/"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 transition-all duration-300 transform hover:scale-105"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Homepage
                </Link>
              </div>
            </div>
          </div>
        </div>
        {/* CTA card */}
        <div className="max-w-xl mx-auto mt-12 bg-white rounded-xl shadow-lg p-8 text-center border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign up or log in to access the marketplace</h2>
          <p className="text-gray-600 mb-6">Create an account or log in to browse and swap services on ServSwap.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="inline-block px-6 py-3 rounded-lg bg-indigo-600 text-white font-semibold shadow hover:bg-indigo-700 transition">Sign Up</Link>
            <Link href="/auth/login" className="inline-block px-6 py-3 rounded-lg bg-white text-indigo-700 font-semibold border border-indigo-600 shadow hover:bg-indigo-50 transition">Log In</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Hero section */}
      <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white py-16 overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
            backgroundSize: '20px 20px'
          }}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="md:flex md:items-center md:justify-between">
            <div className="md:w-3/5">
              <h1 className="text-4xl font-extrabold tracking-tight mb-2 md:text-5xl">
                The Marketplace for <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-yellow-200 drop-shadow-sm">Service Swapping</span>
              </h1>
              <p className="mt-4 text-lg text-indigo-100 max-w-2xl leading-relaxed">
                Find and exchange services based on your skills and talents. 
                <span className="hidden md:inline"> No money needed — create value through collaboration and community.</span>
              </p>
            </div>
            {user && (
              <div className="mt-8 md:mt-0 md:w-2/5 flex justify-end space-x-3">
                <Link
                  href="/dashboard/services/new"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 transition-all duration-300 transform hover:scale-105"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  List Your Service
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-lg text-indigo-700 bg-white hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-400 transition-all duration-300 transform hover:scale-105"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Homepage
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and filter section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-xl rounded-xl p-6 -mt-12 relative z-10 border border-gray-100">
          <div className="md:flex md:items-center md:justify-between gap-6">
            <div className="flex-grow">
              <form onSubmit={handleSearch} className="flex w-full">
                <div className="relative w-full">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search services..."
                    className="w-full pl-10 pr-4 py-3 border-gray-200 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 text-gray-900 placeholder-gray-500 font-medium"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="ml-3 inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300"
                >
                  Search
                </button>
              </form>
            </div>
          </div>
          
          {/* Category filter chips */}
          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedCategory('')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  selectedCategory === '' 
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All Categories
              </button>
              
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    selectedCategory === category 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Services listing section */}
        {isLoading && services.length === 0 ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-indigo-500"></div>
          </div>
        ) : filteredServices.length > 0 ? (
          <>
            <div className="flex items-center justify-between mt-12 mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCategory ? `${selectedCategory} Services` : 'All Services'}
              </h2>
              <p className="text-gray-500 text-sm">
                Showing {filteredServices.length} {filteredServices.length === 1 ? 'service' : 'services'}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  className="bg-white overflow-hidden rounded-xl shadow-md hover:shadow-xl transition-all duration-300 border border-gray-100 flex flex-col h-full transform hover:-translate-y-1 relative cursor-pointer"
                  onClick={() => setSelectedService(service)}
                >
                  {/* Star badge for user's own service */}
                  {user && user.uid === service.userId && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold shadow-sm z-10">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" />
                      </svg>
                      Your service
                    </div>
                  )}
                  <div className="p-6 flex-grow">
                    <div className="flex items-center mb-5">
                      <Link 
                        href={`/profile/${service.userId}`}
                        className="h-12 w-12 rounded-full overflow-hidden mr-4 border-2 border-indigo-100 hover:border-indigo-300 transition-colors"
                      >
                        {service.userAvatar ? (
                          <Image
                            src={service.userAvatar}
                            alt={service.userName}
                            width={48}
                            height={48}
                            className="object-cover h-full w-full"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                            <span className="text-white text-lg font-medium">{service.userName.charAt(0)}</span>
                          </div>
                        )}
                      </Link>
                      <div>
                        <Link 
                          href={`/profile/${service.userId}`}
                          className="text-base font-medium text-gray-900 hover:text-indigo-600 transition-colors flex items-center gap-1"
                        >
                          {service.userName}
                          <VerificationBadge userId={service.userId} className="h-5 w-5 align-text-bottom" />
                          <p className="text-sm text-gray-500 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {service.location}
                          </p>
                        </Link>
                      </div>
                    </div>
                    
                    <h2 className="text-xl font-semibold text-gray-900 mb-3 line-clamp-2">{service.title}</h2>
                    <p className="text-base text-gray-600 mb-5 line-clamp-3">{service.description}</p>
                    
                    <div className="flex items-center justify-between mt-auto">
                      <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium ${getCategoryColor(service.category)}`}>
                        {service.category}
                      </span>
                      <span className="text-sm text-gray-500 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {new Date(service.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 border-t border-gray-100">
                    {user && user.uid === service.userId ? (
                      <Link
                        href={`/dashboard/services/${service.id}/edit`}
                        className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300"
                      >
                        <Pencil className="h-5 w-5 mr-2" />
                        Edit Service
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleInitiateSwap(service.id)}
                        className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Initiate Swap
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  className="inline-flex items-center px-6 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300"
                >
                  Load More Services
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="py-16 px-4 sm:px-6 text-center bg-white rounded-xl shadow-md mt-10">
            <div className="mx-auto w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-indigo-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No services found</h3>
            <p className="mt-4 text-lg text-gray-500 max-w-md mx-auto">
              {searchTerm || selectedCategory 
                ? "We couldn't find any services matching your search criteria. Try adjusting your filters or search terms."
                : "There are no services listed in the marketplace yet. Be the first to list your service!"}
            </p>
            {user && (
              <div className="mt-8">
                <Link
                  href="/dashboard/services/new"
                  className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-md text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  List Your Service
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal for extended view */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={() => setSelectedService(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8 relative" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700" onClick={() => setSelectedService(null)}>
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="flex items-center mb-4">
              {selectedService.userAvatar ? (
                <Image src={selectedService.userAvatar} alt={selectedService.userName} width={48} height={48} className="rounded-full object-cover mr-3" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-lg font-medium mr-3">{selectedService.userName.charAt(0)}</div>
              )}
              <div>
                <div className="font-semibold text-gray-900">{selectedService.userName}</div>
                <div className="text-sm text-gray-500">{selectedService.location}</div>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedService.title}</h2>
            <div className="mb-3 text-sm text-gray-500">Category: <span className="font-medium text-indigo-700">{selectedService.category}</span></div>
            <p className="text-base text-gray-700 mb-4 whitespace-pre-line">{selectedService.description}</p>
            {selectedService.servicesWanted && selectedService.servicesWanted.length > 0 && (
              <div className="mb-4">
                <div className="font-semibold text-gray-900 mb-1">Looking for:</div>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  {selectedService.servicesWanted.map((wanted, i) => (
                    <li key={i}>{wanted}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex justify-end mt-6">
              <button onClick={() => setSelectedService(null)} className="px-5 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Using the Footer component */}
      <Footer />
    </div>
  );
} 