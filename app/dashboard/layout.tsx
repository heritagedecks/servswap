'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import Header from '../components/Header';
import { LucideUsers, LucideLayoutDashboard, CreditCard } from 'lucide-react';
import { getUserSubscription, getAllUserSubscriptions } from '../lib/subscriptions';
import { isSubscriptionActive, isSubscriptionGracePeriod } from '../lib/stripe';
import type { SubscriptionData } from '../lib/stripe';

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

const NavItem = ({ href, icon, label, active }: NavItemProps) => (
  <Link 
    href={href}
    className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
      active ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-100'
    }`}
  >
    <span className={active ? 'text-indigo-600' : 'text-gray-500'}>
      {icon}
    </span>
    <span className="font-medium">{label}</span>
  </Link>
);

function hasActiveMainPlan(subscriptions: SubscriptionData[]): boolean {
  return subscriptions.some(
    (sub: SubscriptionData) => isSubscriptionActive(sub) && sub.planId !== 'verification'
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { signOut, user, loading } = useAuth();
  const [isClient, setIsClient] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Handle authentication on the client side only
  useEffect(() => {
    setIsClient(true);
    if (!loading && !user) {
      router.push('/auth/login');
    }
  }, [loading, user, router]);

  // Fetch unread swap count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!user) return;
      try {
        // Unread swap messages: swaps where user is receiver and read is false
        const swapsQuery = query(
          collection(db, 'swaps'),
          where('receiverId', '==', user.uid),
          where('read', '==', false)
        );
        const unreadSwapsSnapshot = await getDocs(swapsQuery);
        let unreadSwapsCount = unreadSwapsSnapshot.size;

        // Unread connection messages: sum unreadCount for user across all conversations
        let unreadConnectionCount = 0;
        const connectionConvosQuery = query(
          collection(db, 'connectionMessages'),
          where('participants', 'array-contains', user.uid)
          );
        const connectionConvosSnapshot = await getDocs(connectionConvosQuery);
        connectionConvosSnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.unreadCount && typeof data.unreadCount[user.uid] === 'number') {
            unreadConnectionCount += data.unreadCount[user.uid];
          }
        });

        setUnreadCount(unreadSwapsCount + unreadConnectionCount);
      } catch (error) {
        console.error('Error fetching unread count:', error);
        setUnreadCount(0);
      }
    };
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 15000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!loading && user) {
      const checkSub = async () => {
        const subscriptions = await getAllUserSubscriptions(user.uid);
        const hasMain = subscriptions.some(sub => sub.planId !== 'verification' && (isSubscriptionActive(sub) || isSubscriptionGracePeriod(sub)));
        // Only allow access to /dashboard/billing if not subscribed
        if (!hasMain && !pathname.startsWith('/dashboard/billing')) {
          router.replace('/dashboard/billing');
        }
      };
      checkSub();
    }
  }, [user, loading, pathname, router]);

  // Hide support chat bot in dashboard
  useEffect(() => {
    // Get the support chat element by ID or class
    const supportChatElement = document.querySelector('#crisp-chatbox');
    if (supportChatElement) {
      // Hide the support chat in dashboard
      supportChatElement.classList.add('hidden');
    }

    return () => {
      // When unmounting, show the support chat again
      if (supportChatElement) {
        supportChatElement.classList.remove('hidden');
      }
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      // The redirect is handled in the AuthContext
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Show loading state
  if (loading || !isClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  // If not authenticated, don't render anything
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Include Header component */}
      <div className="sticky top-0 z-50">
        <Header />
      </div>
      
      {/* Content wrapper to push content below header */}
      <div className="pt-[61px]">
        {/* Mobile menu toggle - only for dashboard sidebar */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold text-indigo-600">Dashboard</span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
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
              className="h-6 w-6"
            >
              {mobileMenuOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <path d="M4 12h16M4 6h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        <div className="flex relative">
          {/* Sidebar */}
          <aside 
            className={`${
              mobileMenuOpen ? 'block' : 'hidden'
            } lg:block w-64 fixed z-40 bg-white border-r border-gray-200 pt-5 top-[61px] h-[calc(100vh-61px)] overflow-y-auto`}
          >
            <div className="px-6 pb-4 hidden lg:block">
              <Link href="/dashboard" className="block text-center mb-2">
                <span className="text-xl font-bold text-indigo-600">Dashboard</span>
              </Link>
            </div>

            <nav className="px-3 py-6 space-y-1">
              <NavItem 
                href="/dashboard" 
                active={pathname === '/dashboard'}
                icon={
                  <LucideLayoutDashboard className="h-5 w-5" />
                } 
                label="Dashboard" 
              />
              <NavItem 
                href="/dashboard/services" 
                active={pathname === '/dashboard/services'}
                icon={
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
                    className="h-5 w-5"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                } 
                label="My Services" 
              />
              <NavItem 
                href="/dashboard/inbox" 
                active={pathname === '/dashboard/inbox'}
                icon={
                  <div className="relative">
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
                      className="h-5 w-5"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-indigo-600 text-[10px] font-medium text-white flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </div>
                } 
                label="Inbox" 
              />
              <NavItem 
                href="/dashboard/connections" 
                active={pathname === '/dashboard/connections'}
                icon={
                  <LucideUsers className="h-5 w-5" />
                } 
                label="Connections" 
              />
              <NavItem 
                href="/dashboard/swaps" 
                active={pathname === '/dashboard/swaps'}
                icon={
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
                    className="h-5 w-5"
                  >
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
                  </svg>
                } 
                label="My Swaps" 
              />
              <NavItem 
                href="/dashboard/profile" 
                active={pathname === '/dashboard/profile'}
                icon={
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
                    className="h-5 w-5"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                } 
                label="Edit Profile" 
              />
              <NavItem 
                href="/dashboard/settings" 
                active={pathname === '/dashboard/settings'}
                icon={
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
                    className="h-5 w-5"
                  >
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                } 
                label="Settings" 
              />
              <NavItem 
                href="/dashboard/verification" 
                active={pathname === '/dashboard/verification'}
                icon={
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
                    className="h-5 w-5"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                } 
                label="Get Verified" 
              />
              <NavItem 
                href="/dashboard/billing" 
                active={pathname === '/dashboard/billing'}
                icon={<CreditCard className="h-5 w-5" />} 
                label="Billing & Subscription" 
              />
            </nav>

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
              <button 
                onClick={handleSignOut}
                className="flex items-center justify-center w-full gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
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
                  className="h-5 w-5 text-gray-500"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" x2="9" y1="12" y2="12" />
                </svg>
                Log out
              </button>
            </div>
          </aside>

          {/* Main content */}
          <main className={`flex-1 p-4 lg:ml-64 overflow-hidden`}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
} 