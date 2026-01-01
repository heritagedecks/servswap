'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from './context/AuthContext';
import Header from "./components/Header";
import Footer from "./components/Footer";
import IntroPage from './intro/page';
import IntroOverlay from "./intro/IntroOverlay";

// Client-only wrapper component
const ClientOnly = ({ children }: { children: React.ReactNode }) => {
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted) return null;
  return children;
};

const buttonStyle = {
  default: {
    background: 'linear-gradient(to right, #4f46e5, #8b5cf6, #ec4899)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '24px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    border: 'none',
    fontSize: '14px'
  },
  outline: {
    background: 'white',
    color: '#4f46e5',
    padding: '8px 16px',
    borderRadius: '24px',
    fontWeight: 500,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.3s',
    cursor: 'pointer',
    border: '1px solid #e0e7ff',
    fontSize: '14px'
  }
};

export default function Home() {
  const { user } = useAuth();
  const [showIntro, setShowIntro] = useState(false); // Default to false for server rendering

  // Move localStorage check to useEffect to avoid hydration mismatch
  useEffect(() => {
    // Check URL parameters first - allow showing intro with ?intro=true
    const urlParams = new URLSearchParams(window.location.search);
    const showIntroParam = urlParams.get('intro');
    
    if (showIntroParam === 'true') {
      setShowIntro(true);
      return;
    }
    
    // Check if user has already seen the intro in this session
    const hasSeenIntro = sessionStorage.getItem('hasSeenIntro');
    if (!hasSeenIntro) {
      setShowIntro(true);
    }
  }, []);

  // When the intro finishes, set sessionStorage flag
  const handleIntroFinish = () => {
    sessionStorage.setItem('hasSeenIntro', 'true');
    setShowIntro(false);
  };

  return (
    <div className="flex min-h-screen flex-col relative">
      <Header />
      <ClientOnly>
        {showIntro && (
          <div className="fixed inset-0 z-50 pointer-events-auto">
            <IntroOverlay onFinish={handleIntroFinish} />
          </div>
        )}
      </ClientOnly>
      
      {/* Hero Section with modern gradient and patterns */}
      <section className="w-full py-24 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"></div>
        
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
            backgroundSize: '20px 20px'
          }}></div>
        </div>
        
        <div className="container relative px-4 md:px-6 mx-auto z-10">
          <div className="flex flex-col items-center space-y-8 text-center">
            <div className="space-y-4 max-w-3xl">
              <h1 className="text-5xl font-bold tracking-tighter sm:text-6xl md:text-7xl text-white">
                Trade Skills, Not <span className="bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-yellow-200 drop-shadow-sm">Money</span>
              </h1>
              <p className="mx-auto max-w-[800px] text-xl md:text-2xl text-indigo-100 leading-relaxed">
                ServSwap is a revolutionary new platform where you can exchange services based on your skills and talents.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <Link 
                href="/marketplace" 
                className="inline-flex h-12 items-center justify-center rounded-lg bg-white px-8 text-base font-medium text-indigo-600 shadow-lg hover:bg-indigo-50 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2"
              >
                Explore Services
              </Link>
              <a 
                href="#how-it-works-section" 
                className="inline-flex h-12 items-center justify-center rounded-lg border border-white bg-transparent px-8 text-base font-medium text-white shadow-sm transition-colors hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-indigo-600"
              >
                Learn More
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="how-it-works-section" className="w-full py-16 bg-gradient-to-b from-gray-50 to-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">How ServSwap Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Exchange services with others in three simple steps</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Create Your Profile</h3>
              <p className="text-gray-600">Sign up and list the services you can offer based on your skills and expertise.</p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Discover Services</h3>
              <p className="text-gray-600">Browse through services offered by others in your local community or remotely.</p>
            </div>
            
            <div className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Initiate Swaps</h3>
              <p className="text-gray-600">Request a service swap and collaborate with others. ServSwap is a subscription-based platform—no hidden fees, just one simple monthly or annual plan.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories Section */}
      <section className="w-full py-16 bg-gradient-to-b from-white to-gray-50">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">Explore Categories</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">Find services across various categories to meet your needs</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/marketplace?category=Technology" className="group">
              <div className="p-6 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-blue-800 group-hover:text-blue-900 transition-colors duration-300">Technology</h3>
                <p className="text-sm text-blue-600">Web development, app creation, IT support</p>
              </div>
            </Link>
            
            <Link href="/marketplace?category=Design" className="group">
              <div className="p-6 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-purple-800 group-hover:text-purple-900 transition-colors duration-300">Design</h3>
                <p className="text-sm text-purple-600">Graphic design, UX/UI, illustration</p>
              </div>
            </Link>
            
            <Link href="/marketplace?category=Marketing" className="group">
              <div className="p-6 bg-green-50 rounded-xl hover:bg-green-100 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-green-800 group-hover:text-green-900 transition-colors duration-300">Marketing</h3>
                <p className="text-sm text-green-600">Social media, SEO, content strategy</p>
              </div>
            </Link>
            
            <Link href="/marketplace?category=Writing" className="group">
              <div className="p-6 bg-yellow-50 rounded-xl hover:bg-yellow-100 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-yellow-800 group-hover:text-yellow-900 transition-colors duration-300">Writing</h3>
                <p className="text-sm text-yellow-600">Copywriting, proofreading, translation</p>
              </div>
            </Link>
            
            <Link href="/marketplace?category=Business" className="group">
              <div className="p-6 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-gray-800 group-hover:text-gray-900 transition-colors duration-300">Business</h3>
                <p className="text-sm text-gray-600">Consulting, accounting, planning</p>
              </div>
            </Link>
            
            <Link href="/marketplace?category=Lifestyle" className="group">
              <div className="p-6 bg-pink-50 rounded-xl hover:bg-pink-100 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-pink-800 group-hover:text-pink-900 transition-colors duration-300">Lifestyle</h3>
                <p className="text-sm text-pink-600">Fitness, cooking, home organization</p>
              </div>
            </Link>
            
            <Link href="/marketplace?category=Education" className="group">
              <div className="p-6 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-indigo-800 group-hover:text-indigo-900 transition-colors duration-300">Education</h3>
                <p className="text-sm text-indigo-600">Tutoring, language lessons, training</p>
              </div>
            </Link>
            
            <Link href="/marketplace" className="group">
              <div className="p-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl hover:from-indigo-100 hover:to-purple-100 transition-colors duration-300">
                <h3 className="text-lg font-semibold text-indigo-800 group-hover:text-indigo-900 transition-colors duration-300">View All</h3>
                <p className="text-sm text-indigo-600">Explore all available categories</p>
              </div>
            </Link>
          </div>
        </div>
      </section>
      
      {/* About Section */}
      <section id="about-section" className="w-full py-20 bg-gradient-to-b from-gray-50 to-white overflow-hidden">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4">
                  About <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600">ServSwap</span>
                </h2>
                <div className="w-20 h-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full mb-6"></div>
                <p className="text-lg text-gray-700 leading-relaxed mb-6">
                  ServSwap was born from a simple idea: in a world driven by monetary transactions, we wanted to create a community where people could exchange their talents and skills directly, bypassing traditional currency altogether.
                </p>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Our platform connects individuals with complementary skills, enabling them to trade services in a fair, transparent, and secure environment. Whether you're a graphic designer who needs accounting help, or a tutor looking for website development, ServSwap creates connections that benefit everyone involved.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">Community Driven</h3>
                  <p className="text-gray-600">Built around trust, mutual respect, and shared value creation among our members.</p>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 border border-gray-100">
                  <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900">Trust & Safety</h3>
                  <p className="text-gray-600">Verification system and feedback mechanisms ensure quality interactions.</p>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-100 rounded-full opacity-50 blur-3xl"></div>
              <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-purple-100 rounded-full opacity-50 blur-2xl"></div>
              
              <div className="relative bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">Our Mission</h4>
                      <p className="text-gray-600">To create an economy based on direct service exchange, enabling people to leverage their skills without financial barriers.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">Our Vision</h4>
                      <p className="text-gray-600">A world where everyone can access services they need by offering their unique talents, creating a more equitable economy.</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-pink-100 rounded-full flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">Subscription Model</h4>
                      <p className="text-gray-600">A simple, transparent membership fee of $10/month lets you exchange unlimited services—no commissions or hidden costs.</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <div className="text-center">
                    <span className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">New Platform Launch</span>
                    <p className="mt-3 text-gray-600">Be among the first to join our community and help shape the future of service exchange.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="w-full py-20 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{ 
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z\' fill=\'%23ffffff\' fill-opacity=\'1\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
            backgroundSize: '20px 20px'
          }}></div>
        </div>
        
        <div className="container relative px-4 md:px-6 mx-auto z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl font-bold mb-4">Be an Early Adopter</h2>
            <p className="text-xl text-indigo-100 mb-8">Join ServSwap during our launch phase and be among the first to build our community of service exchange. Plans start at just <span className='font-semibold text-white'>$10/month</span> (or save with annual billing). Verified badge available for an extra <span className='font-semibold text-white'>$5/month</span>.</p>
            <Link 
              href="/auth/signup" 
              className="inline-flex items-center px-8 py-4 border border-transparent text-lg font-medium rounded-lg shadow-xl bg-white text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-300 transform hover:scale-105"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Start Your Subscription
            </Link>
          </div>
        </div>
      </section>
      
      <Footer />
    </div>
  );
}
