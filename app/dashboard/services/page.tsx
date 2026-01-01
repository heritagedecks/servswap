'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  isActive: boolean;
  images: string[];
  createdAt: Date;
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchServices = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const q = query(
          collection(db, 'services'),
          where('userId', '==', user.uid)
        );
        
        const querySnapshot = await getDocs(q);
        const servicesList: Service[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          servicesList.push({
            id: doc.id,
            title: data.title,
            description: data.description,
            category: data.category,
            isActive: data.isActive,
            images: data.images || [],
            createdAt: data.createdAt?.toDate() || new Date(),
          });
        });
        
        setServices(servicesList);
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchServices();
  }, [user]);

  // Mock data for initial development
  const mockServices = [
    {
      id: '1',
      title: 'Web Development',
      description: 'Full-stack web development using modern technologies like React, Node.js, and MongoDB.',
      category: 'Technology',
      isActive: true,
      images: ['https://placehold.co/600x400/indigo/white?text=Web+Development'],
      createdAt: new Date('2023-07-15'),
    },
    {
      id: '2',
      title: 'Logo Design',
      description: 'Professional logo design for your brand or business.',
      category: 'Design',
      isActive: true,
      images: ['https://placehold.co/600x400/teal/white?text=Logo+Design'],
      createdAt: new Date('2023-08-20'),
    },
    {
      id: '3',
      title: 'Content Writing',
      description: 'High-quality content writing for blogs, websites, and marketing materials.',
      category: 'Writing',
      isActive: false,
      images: ['https://placehold.co/600x400/pink/white?text=Content+Writing'],
      createdAt: new Date('2023-09-10'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">My Services</h1>
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

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      ) : services.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Use actual services when available, otherwise use mock data */}
          {(services.length > 0 ? services : mockServices).map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow duration-200 overflow-hidden"
            >
              <div className="h-48 bg-gray-200 relative">
                {service.images && service.images.length > 0 ? (
                  <Image
                    src={service.images[0]}
                    alt={service.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-gray-400">No image</span>
                  </div>
                )}
                <div className="absolute top-2 right-2 flex space-x-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    service.isActive 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {service.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                    {service.category}
                  </span>
                </div>
              </div>
              
              <div className="p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{service.title}</h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description}</p>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {service.createdAt.toLocaleDateString()}
                  </span>
                  <div>
                    <Link
                      href={`/dashboard/services/${service.id}/edit`}
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium mr-3"
                    >
                      Edit
                    </Link>
                    <button
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border rounded-lg p-8 text-center">
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
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">No services yet</h3>
          <p className="mt-2 text-gray-500 max-w-md mx-auto">
            You haven't added any services yet. Get started by adding your first service to showcase your skills.
          </p>
          <div className="mt-6">
            <Link
              href="/dashboard/services/new"
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Your First Service
            </Link>
          </div>
        </div>
      )}
    </div>
  );
} 