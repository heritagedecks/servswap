'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button, LinkButton } from "../components/ui/button";
import { scrollToSection, scrollToTop } from "../lib/utils";
import { Home as HomeIcon, LayoutDashboard, LogOut, Home as HomeIcon2, Store, Info, Mail, Bell, CheckCircle, XCircle, MessageSquare, Heart, UserPlus, ChevronDown, ChevronUp, Settings, User as UserIcon, Menu as MenuIcon, X as CloseIcon, UserRoundCog, Headphones, Newspaper, AtSign, CreditCard } from 'lucide-react';
import React, { createContext, useContext } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, updateDoc } from 'firebase/firestore';
import { auth } from '../lib/firebase';
import ProfileAvatar from './ProfileAvatar';

// Context to share logo ref
export const LogoRefContext = createContext<React.RefObject<HTMLImageElement | null> | null>(null);

export default function Header() {
  const { user, signOut } = useAuth();
  const [isHomeMenuOpen, setIsHomeMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const homeMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const isHomePage = pathname === '/';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const logoRef = useRef<HTMLImageElement>(null);

  // Fetch unread count on mount and when user changes
  useEffect(() => {
    if (!user) return;
    const fetchNotificationCount = async () => {
      try {
        const notifQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          where('isRead', '==', false)
        );
        const notifSnapshot = await getDocs(notifQuery);
        setUnreadCount(notifSnapshot.size);
      } catch (error) {
        // ignore
      }
    };
    fetchNotificationCount();
  }, [user]);

  // Close menus on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (homeMenuRef.current && !homeMenuRef.current.contains(e.target as Node)) {
        setIsHomeMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Log out handler
  const handleLogout = async () => {
    try {
      await signOut();
      // Router push will be handled in the signOut function
    } catch (error) {
      console.error('Error signing out:', error);
      // Force navigation to login page even if signOut fails
      router.push('/auth/login');
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur shadow-sm border-b border-gray-100">
      <div className="flex items-center justify-between h-16 px-2 md:px-4 lg:px-6 mx-auto max-w-7xl relative">
        {/* Left: Logo and site name */}
        <div className="flex items-center flex-shrink-0 mr-2 md:mr-3 lg:mr-4">
          <Link href="/" className="flex items-center gap-1.5 md:gap-2 lg:gap-3 group">
            <Image ref={logoRef} src="/logo-redesigned.png" alt="ServSwap Logo" width={40} height={40} className="w-8 h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 rounded-lg shadow-sm transition-transform duration-200 ease-in-out group-hover:scale-110" />
            <span className="font-semibold text-sm md:text-base lg:text-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent transition-transform duration-200 ease-in-out group-hover:scale-105">ServSwap</span>
          </Link>
        </div>
        {/* Center: Main Menu (hidden on mobile) */}
        <nav className="hidden md:flex items-center gap-1 md:gap-2 lg:gap-3 flex-1 justify-center">
          {/* Home with sub-menu only on home page */}
          <div className="relative" ref={homeMenuRef}>
            {isHomePage ? (
              <button
                className="flex items-center gap-1 px-2 md:px-2.5 lg:px-3 py-2 rounded-lg font-semibold text-gray-800 hover:bg-indigo-50 transition group text-sm lg:text-base"
                onClick={() => setIsHomeMenuOpen((v) => !v)}
                aria-haspopup="true"
                aria-expanded={isHomeMenuOpen}
                type="button"
              >
                <HomeIcon className="w-5 h-5 text-indigo-500 group-hover:text-indigo-700 transition" />
                <span className="hidden lg:inline">Home</span>
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isHomeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
            ) : (
              <Link
                href="/"
                className="flex items-center gap-1 px-2 md:px-2.5 lg:px-3 py-2 rounded-lg font-semibold text-gray-800 hover:bg-indigo-50 transition group text-sm lg:text-base"
              >
                <HomeIcon className="w-5 h-5 text-indigo-500 group-hover:text-indigo-700 transition" />
                <span className="hidden lg:inline">Home</span>
              </Link>
            )}
            {/* Sub-menu only on home page */}
            {isHomePage && isHomeMenuOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-100 rounded-xl shadow-lg py-2 animate-dropdown-fade z-50">
                <button
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-indigo-50 transition"
                  onClick={() => { scrollToSection(undefined, 'how-it-works-section', true, true); setIsHomeMenuOpen(false); }}
                >How it Works</button>
                <button
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-indigo-50 transition"
                  onClick={() => { scrollToSection(undefined, 'about-section', true, true); setIsHomeMenuOpen(false); }}
                >About</button>
              </div>
            )}
          </div>
          <Link href="/marketplace" className="flex items-center gap-1 px-2 md:px-2.5 lg:px-3 py-2 rounded-lg font-semibold text-gray-800 hover:bg-indigo-50 transition text-sm lg:text-base">
            <Store className="w-5 h-5 text-indigo-500" />
            <span className="hidden lg:inline">Marketplace</span>
          </Link>
          <Link href="/swapfeed" className="flex items-center gap-1 px-2 md:px-2.5 lg:px-3 py-2 rounded-lg font-semibold text-gray-800 hover:bg-indigo-50 transition text-sm lg:text-base">
            <Newspaper className="w-5 h-5 text-indigo-500" />
            <span className="hidden lg:inline">SwapFeed</span>
          </Link>
          <Link href="/pricing" className="flex items-center gap-1 px-2 md:px-2.5 lg:px-3 py-2 rounded-lg font-semibold text-gray-800 hover:bg-indigo-50 transition text-sm lg:text-base">
            <CreditCard className="w-5 h-5 text-indigo-500" />
            <span className="hidden lg:inline">Pricing</span>
          </Link>
          <Link href="/support" className="flex items-center gap-1 px-2 md:px-2.5 lg:px-3 py-2 rounded-lg font-semibold text-gray-800 hover:bg-indigo-50 transition text-sm lg:text-base">
            <UserRoundCog className="w-5 h-5 text-indigo-500" />
            <span className="hidden lg:inline">Support</span>
            </Link>
          </nav>
        {/* Hamburger for mobile */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-indigo-50 transition flex items-center justify-center"
          aria-label="Open menu"
          onClick={() => setIsMobileMenuOpen(true)}
          >
          <MenuIcon className="w-7 h-7 text-indigo-500" />
        </button>
        {/* Right: Icon Menu (shrink for md) */}
        <div className="flex items-center gap-0.5 md:gap-1.5 lg:gap-2 flex-shrink-0">
          {user ? (
            <>
              <Link href="/dashboard" className="p-1.5 md:p-1.5 lg:p-2 rounded-full hover:bg-indigo-50 transition group" aria-label="Dashboard">
                <LayoutDashboard className="w-5 h-5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-indigo-500 group-hover:text-indigo-700 transition" />
              </Link>
              <Link href={`/profile/${user.uid}`} className="p-1.5 md:p-1.5 lg:p-2 rounded-full hover:bg-indigo-50 transition group" aria-label="My Profile">
                <UserIcon className="w-5 h-5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-indigo-500 group-hover:text-indigo-700 transition" />
              </Link>
              <div className="relative" ref={notifRef}>
                <button
                  className="p-1.5 md:p-1.5 lg:p-2 rounded-full hover:bg-indigo-50 transition group relative"
                  aria-label="Notifications"
                  onClick={() => setIsNotifOpen((v) => !v)}
                  >
                  <Bell className="w-5 h-5 md:w-4 md:h-4 lg:w-5 lg:h-5 text-indigo-500 group-hover:text-indigo-700 transition" />
                  {typeof window !== 'undefined' && (
                    <NotificationBadge unreadCount={unreadCount} />
                  )}
                  </button>
                {isNotifOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-100 rounded-xl shadow-lg py-2 animate-dropdown-fade z-50">
                    <NotificationBell isOpen={isNotifOpen} setIsOpen={setIsNotifOpen} unreadCount={unreadCount} setUnreadCount={setUnreadCount} />
          </div>
        )}
              </div>
              <div className="relative" ref={userMenuRef}>
                <div
                  className="flex items-center gap-1 cursor-pointer select-none"
                  onClick={() => setIsUserMenuOpen((v) => !v)}
                  aria-haspopup="true"
                  aria-expanded={isUserMenuOpen}
                tabIndex={0}
                  style={{ position: 'relative' }}
              >
                  <ProfileAvatar 
                    src={user.photoURL} 
                    alt={user.displayName || 'User'} 
                    size={32} 
                    className="transition-transform duration-200 hover:scale-110"
                  />
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
                </div>
                {/* Animated expanding dropdown */}
                <div
                  className={`absolute top-0 right-0 mt-0 flex flex-col items-start bg-white border border-gray-100 rounded-2xl shadow-2xl z-50 py-3 px-2 transition-all duration-300 ease-in-out origin-top-right
                    ${isUserMenuOpen ? 'w-72 min-w-[18rem] opacity-100 scale-100 translate-x-0 pointer-events-auto' : 'w-0 max-w-0 opacity-0 scale-95 translate-x-full pointer-events-none overflow-hidden'}
                  `}
                  style={{ minWidth: isUserMenuOpen ? 288 : 0 }}
                >
                  {/* Only show user info and menu if open */}
                  {isUserMenuOpen && (
                    <>
                      {/* User Card */}
                      <div className="flex items-center gap-3 px-3 pb-3 border-b border-gray-100 mb-2 w-full">
                        <ProfileAvatar 
                          src={user.photoURL} 
                          alt={user.displayName || 'User'} 
                          size={44} 
                        />
                        <div className="flex flex-col min-w-0">
                          <button
                            className="font-semibold text-gray-900 truncate max-w-[120px] text-left transition hover:text-indigo-600 hover:scale-105 focus:text-indigo-600 focus:scale-105"
                            onClick={() => setIsUserMenuOpen(false)}
                            tabIndex={0}
                            aria-label="Minimize profile dropdown"
                            style={{ outline: 'none', border: 'none', background: 'none', padding: 0, margin: 0 }}
                          >
                            {user.displayName || 'User'}
                          </button>
                          <span className="text-xs text-gray-500 truncate max-w-[120px]">{user.email}</span>
                        </div>
                      </div>
                      {/* Menu Items */}
                      <div className="flex flex-col gap-1 mt-1 w-full">
                        <Link href="/dashboard/inbox" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-indigo-50 transition">
                          <Mail className="w-5 h-5 text-indigo-400" />
                          <span>Inbox</span>
                        </Link>
                        <Link href="/dashboard/settings" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-indigo-50 transition">
                          <Settings className="w-5 h-5 text-indigo-400" />
                          <span>Settings</span>
                        </Link>
                        <Link href="/dashboard/billing" className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-indigo-50 transition">
                          <CreditCard className="w-5 h-5 text-indigo-400" />
                          <span>Billing & Subscription</span>
                        </Link>
                <button
                          onClick={handleLogout}
                          className="flex items-center gap-3 px-4 py-2 rounded-xl hover:bg-red-50 text-red-600 transition w-full text-left"
                >
                          <LogOut className="w-5 h-5 text-red-400" />
                          <span>Log out</span>
                </button>
                    </div>
                    </>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/signup" className="px-3 py-2 rounded-lg font-semibold text-indigo-600 hover:bg-indigo-50 transition text-sm md:text-xs lg:text-base">Sign Up</Link>
              <Link href="/auth/login" className="px-3 py-2 rounded-lg font-semibold text-gray-700 hover:bg-indigo-50 transition text-sm md:text-xs lg:text-base">Sign In</Link>
            </>
          )}
        </div>
        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-[2000] bg-black/40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            {/* Dropdown below header, but overlay covers whole screen */}
            <div
              className="w-screen bg-white shadow-2xl border-b border-gray-100 flex flex-col p-4 animate-popup z-[2100]"
              style={{ borderRadius: 0, marginTop: '4rem', maxWidth: '100vw' }}
              onClick={e => e.stopPropagation()}
            >
              <button
                className="absolute top-4 right-4 text-gray-400 hover:text-indigo-600 transition"
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="Close menu"
              >
                <CloseIcon className="w-7 h-7" />
              </button>
              <nav className="flex flex-col gap-2 mt-8">
                {/* Home: expandable sub-menu only on home page */}
                {isHomePage ? (
                  <div className="relative">
                    <button
                      className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-gray-800 hover:bg-indigo-50 transition w-full text-left"
                      onClick={() => setIsHomeMenuOpen((v) => !v)}
                      aria-haspopup="true"
                      aria-expanded={isHomeMenuOpen}
                    >
                      <HomeIcon className="w-5 h-5 text-indigo-500" />
                      <span>Home</span>
                      <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isHomeMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-200 ease-in-out ${isHomeMenuOpen ? 'max-h-32 opacity-100' : 'max-h-0 opacity-0'}`}
                      style={{ marginLeft: isHomeMenuOpen ? 32 : 0 }}
                    >
                      <button
                        className="block w-full text-left px-8 py-2 text-gray-700 hover:bg-indigo-50 transition text-sm rounded-lg"
                        onClick={() => { scrollToSection(undefined, 'how-it-works-section', true, true); setIsHomeMenuOpen(false); setIsMobileMenuOpen(false); }}
                      >How it Works</button>
                      <button
                        className="block w-full text-left px-8 py-2 text-gray-700 hover:bg-indigo-50 transition text-sm rounded-lg"
                        onClick={() => { scrollToSection(undefined, 'about-section', true, true); setIsHomeMenuOpen(false); setIsMobileMenuOpen(false); }}
                      >About</button>
                    </div>
                  </div>
                ) : (
                  <Link href="/" className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-gray-800 hover:bg-indigo-50 transition" onClick={() => setIsMobileMenuOpen(false)}>
                    <HomeIcon className="w-5 h-5 text-indigo-500" />
                    <span>Home</span>
                  </Link>
                )}
                <Link href="/marketplace" className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-gray-800 hover:bg-indigo-50 transition" onClick={() => setIsMobileMenuOpen(false)}>
                  <Store className="w-5 h-5 text-indigo-500" />
                  <span>Marketplace</span>
                </Link>
                <Link href="/swapfeed" className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-gray-800 hover:bg-indigo-50 transition" onClick={() => setIsMobileMenuOpen(false)}>
                  <Newspaper className="w-5 h-5 text-indigo-500" />
                  <span>SwapFeed</span>
                </Link>
                <Link href="/pricing" className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-gray-800 hover:bg-indigo-50 transition" onClick={() => setIsMobileMenuOpen(false)}>
                  <CreditCard className="w-5 h-5 text-indigo-500" />
                  <span>Pricing</span>
                </Link>
                <Link href="/support" className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-gray-800 hover:bg-indigo-50 transition" onClick={() => setIsMobileMenuOpen(false)}>
                  <UserRoundCog className="w-5 h-5 text-indigo-500" />
                  <span>Support</span>
                </Link>
              </nav>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

function DropdownMenu({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    try {
      await signOut();
      // Router push will be handled in the signOut function
    } catch (error) {
      console.error('Error signing out:', error);
      // Force navigation to login page even if signOut fails
      router.push('/auth/login');
    }
  };

  if (!user) return null;

  return (
    <div
      ref={menuRef}
      className={`absolute right-0 mt-2 w-64 bg-white/80 backdrop-blur-lg border border-gray-100 rounded-2xl shadow-2xl z-50 py-3 px-2 transition-all duration-200 origin-top-right
        ${isOpen ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 -translate-y-2 pointer-events-none'}
        animate-dropdown-fade`}
      style={{ minWidth: 220 }}
    >
      {/* User Card */}
      <div className="flex items-center gap-3 px-3 pb-3 border-b border-gray-100 mb-2">
        <ProfileAvatar 
          src={user.photoURL} 
          alt={user.displayName || 'User'} 
          size={44} 
          className="border-2 border-indigo-200" 
        />
        <div className="flex flex-col min-w-0">
          <span className="font-semibold text-gray-900 truncate max-w-[120px]">{user.displayName || 'User'}</span>
          <span className="text-xs text-gray-500 truncate max-w-[120px]">{user.email}</span>
        </div>
      </div>
      {/* Menu Items */}
      <div className="flex flex-col gap-1 mt-1">
        <Link href="/dashboard" className="flex items-center gap-3 px-4 py-2 rounded-xl group transition-all duration-150 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:text-indigo-700 hover:shadow-sm border-l-4 border-transparent group-hover:border-indigo-400">
          <LayoutDashboard className="w-5 h-5 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
          <span className="font-medium">Dashboard</span>
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-2 rounded-xl group transition-all duration-150 hover:bg-gradient-to-r hover:from-red-50 hover:to-red-100 hover:text-red-700 hover:shadow-sm border-l-4 border-transparent group-hover:border-red-400 w-full text-left"
        >
          <LogOut className="w-5 h-5 text-red-400 group-hover:text-red-600 transition-colors" />
          <span className="font-medium">Log out</span>
        </button>
      </div>
    </div>
  );
}

type NotificationBellProps = {
  isOpen: boolean;
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
};

interface Notification {
  id: string;
  type: 'swap_request' | 'swap_accept' | 'swap_reject' | 'message' | 'comment' | 'like' | 'follow' | 'swap_complete' | 'mention';
  read: boolean;
  timestamp: Date;
  message: string;
  link: string;
  icon: React.ReactNode;
}

function NotificationBadge({ unreadCount }: { unreadCount: number }) {
  if (!unreadCount || unreadCount === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-600 text-xs font-bold text-white flex items-center justify-center shadow-md z-10">
      {unreadCount > 9 ? '9+' : unreadCount}
    </span>
  );
}

function NotificationBell({ isOpen, setIsOpen, unreadCount, setUnreadCount }: NotificationBellProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Fetch notifications count immediately when component loads
  useEffect(() => {
    if (!user) return;
    
    const fetchNotificationCount = async () => {
      try {
        const notifQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          where('isRead', '==', false)
        );
        
        const notifSnapshot = await getDocs(notifQuery);
        setUnreadCount(notifSnapshot.size);
      } catch (error) {
        console.error('Error fetching notification count:', error);
      }
    };

    fetchNotificationCount();
  }, [user]);

  // Fetch full notifications when bell is clicked
  useEffect(() => {
    if (!isOpen || !user) return;
    setLoading(true);
    (async () => {
      try {
        console.log('Fetching notifications for user:', user.uid);
        
        // Get all notifications for the user, limited to last 10
        const notifQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(10)
        );
        
        const notifSnapshot = await getDocs(notifQuery);
        console.log('Found notifications:', notifSnapshot.size);
        
        const allNotifications: Notification[] = [];

        // Process each notification
        for (const doc of notifSnapshot.docs) {
          const data = doc.data();
          console.log('Processing notification:', data);
          
          let notification: Notification = {
            id: doc.id,
            type: data.type,
            read: data.isRead || false,
            timestamp: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
            message: '',
            link: '',
            icon: null
          };

          // Format notification based on type
          switch (data.type) {
            case 'swap_request':
              notification.message = `${data.senderName} requested to swap "${data.serviceTitle}" with you`;
              notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
              notification.icon = <Store className="w-5 h-5 text-indigo-400" />;
              break;
            case 'swap_accept':
              notification.message = `${data.senderName} accepted your swap request for "${data.serviceTitle}"`;
              notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
              notification.icon = <CheckCircle className="w-5 h-5 text-green-400" />;
              break;
            case 'swap_reject':
              notification.message = `${data.senderName} declined your swap request for "${data.serviceTitle}"`;
              notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
              notification.icon = <XCircle className="w-5 h-5 text-red-400" />;
              break;
            case 'swap_complete':
              notification.message = `${data.senderName} marked the swap "${data.serviceTitle}" as complete`;
              notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
              notification.icon = <CheckCircle className="w-5 h-5 text-green-400" />;
              break;
            case 'message':
              if (data.conversationId) {
              notification.message = `${data.senderName} sent you a message: "${data.message}"`;
                notification.link = `/dashboard/inbox?chat=${data.conversationId}`;
                notification.icon = <Mail className="w-5 h-5 text-indigo-400" />;
              } else {
                notification.message = data.message || `${data.senderName} sent you a message`;
                notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
              notification.icon = <Mail className="w-5 h-5 text-indigo-400" />;
              }
              break;
            case 'comment':
              notification.message = `${data.senderName} commented on your post: "${data.comment}"`;
              notification.link = `/profile/${user.uid}?postId=${data.postId}`;
              notification.icon = <MessageSquare className="w-5 h-5 text-indigo-400" />;
              break;
            case 'like':
              notification.message = `${data.senderName} liked your post`;
              notification.link = `/profile/${user.uid}?postId=${data.postId}`;
              notification.icon = <Heart className="w-5 h-5 text-red-400" />;
              break;
            case 'follow':
              notification.message = data.message || `${data.senderName} started following you`;
              notification.link = data.link || `/profile/${data.senderId}`;
              notification.icon = <UserIcon className="w-5 h-5 text-indigo-400" />;
              break;
            case 'mention':
              notification.message = data.message || `${data.senderName} mentioned you in ${data.contentContext || 'a post'}`;
              notification.link = data.link || `/profile/${data.senderId}?postId=${data.postId}`;
              notification.icon = <AtSign className="w-5 h-5 text-indigo-400" />;
              break;
            default:
              console.log('Unknown notification type:', data.type);
              continue; // Skip unknown notification types
          }

          allNotifications.push(notification);
        }

        console.log('Processed notifications:', allNotifications);
        setNotifications(allNotifications);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, user]);

  // Fetch all notifications for 'View All'
  const fetchAllNotifications = async () => {
    if (!user) return;
    setAllLoading(true);
    try {
      const notifQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        // Remove limit for all
      );
      const notifSnapshot = await getDocs(notifQuery);
      const all: Notification[] = [];
      for (const doc of notifSnapshot.docs) {
        const data = doc.data();
        let notification: Notification = {
          id: doc.id,
          type: data.type,
          read: data.isRead || false,
          timestamp: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(),
          message: '',
          link: '',
          icon: null
        };
        switch (data.type) {
          case 'swap_request':
            notification.message = `${data.senderName} requested to swap "${data.serviceTitle}" with you`;
            notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
            notification.icon = <Store className="w-5 h-5 text-indigo-400" />;
            break;
          case 'swap_accept':
            notification.message = `${data.senderName} accepted your swap request for "${data.serviceTitle}"`;
            notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
            notification.icon = <CheckCircle className="w-5 h-5 text-green-400" />;
            break;
          case 'swap_reject':
            notification.message = `${data.senderName} declined your swap request for "${data.serviceTitle}"`;
            notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
            notification.icon = <XCircle className="w-5 h-5 text-red-400" />;
            break;
          case 'swap_complete':
            notification.message = `${data.senderName} marked the swap "${data.serviceTitle}" as complete`;
            notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
            notification.icon = <CheckCircle className="w-5 h-5 text-green-400" />;
            break;
          case 'message':
            if (data.conversationId) {
              notification.message = `${data.senderName} sent you a message: "${data.message}"`;
              notification.link = `/dashboard/inbox?chat=${data.conversationId}`;
              notification.icon = <Mail className="w-5 h-5 text-indigo-400" />;
            } else {
              notification.message = data.message || `${data.senderName} sent you a message`;
              notification.link = `/dashboard/inbox?swapId=${data.swapId}`;
              notification.icon = <Mail className="w-5 h-5 text-indigo-400" />;
            }
            break;
          case 'comment':
            notification.message = `${data.senderName} commented on your post: "${data.comment}"`;
            notification.link = `/profile/${user.uid}?postId=${data.postId}`;
            notification.icon = <MessageSquare className="w-5 h-5 text-indigo-400" />;
            break;
          case 'like':
            notification.message = `${data.senderName} liked your post`;
            notification.link = `/profile/${user.uid}?postId=${data.postId}`;
            notification.icon = <Heart className="w-5 h-5 text-red-400" />;
            break;
            case 'follow':
              notification.message = data.message || `${data.senderName} started following you`;
              notification.link = data.link || `/profile/${data.senderId}`;
              notification.icon = <UserIcon className="w-5 h-5 text-indigo-400" />;
              break;
            case 'mention':
              notification.message = data.message || `${data.senderName} mentioned you in ${data.contentContext || 'a post'}`;
              notification.link = data.link || `/profile/${data.senderId}?postId=${data.postId}`;
              notification.icon = <AtSign className="w-5 h-5 text-indigo-400" />;
              break;
            default:
              console.log('Unknown notification type:', data.type);
              continue; // Skip unknown notification types
        }
        all.push(notification);
      }
      setAllNotifications(all);
      } catch (error) {
      console.error('Error fetching all notifications:', error);
    } finally {
      setAllLoading(false);
    }
  };

  // Add click outside to close for View All Modal
  useEffect(() => {
    if (!viewAllOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setViewAllOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [viewAllOpen]);

  const handleNotificationClick = async (notif: Notification) => {
    if (!user || notif.read) return;
    
    try {
      // Mark notification as read in Firestore
      await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
      
      // Update local state
      setNotifications(prev => prev.map(n => 
        n.id === notif.id ? { ...n, read: true } : n
      ));
      
      // Update unread count
      setUnreadCount((prev: number) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  return (
    <div ref={menuRef} className="px-2">
      <div className="flex items-center justify-between px-2 pb-2 border-b border-gray-100 mb-2">
        <span className="font-semibold text-gray-900 text-base">Notifications</span>
      <button
          className="text-xs text-indigo-600 hover:underline focus:underline disabled:opacity-50"
          onClick={async () => {
            if (!user) return;
            // Mark all as read
            setLoading(true);
            try {
              const notifQuery = query(
                collection(db, 'notifications'),
                where('userId', '==', user.uid),
                where('isRead', '==', false)
              );
              const notifSnapshot = await getDocs(notifQuery);
              for (const docSnap of notifSnapshot.docs) {
                await updateDoc(doc(db, 'notifications', docSnap.id), { isRead: true });
              }
              setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
              setUnreadCount(0);
            } catch (e) {
              // ignore
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading || unreadCount === 0}
        >
          Mark all as read
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <span className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full mr-2"></span>
            Loading...
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-gray-400">No notifications</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notifications.map((notif) => (
              <li
                key={notif.id} 
                className={`flex items-start gap-3 px-2 py-3 hover:bg-indigo-50 rounded-lg transition ${notif.read ? '' : 'bg-indigo-50/50'}`}
              >
                <div className="flex-shrink-0 mt-1">{notif.icon}</div>
                <div className="flex-1 min-w-0">
                  <Link 
                    href={notif.link} 
                    className="block text-sm text-gray-900 font-medium truncate hover:underline" 
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!user || notif.read) return;
                      
                      try {
                        // Mark notification as read in Firestore
                        await updateDoc(doc(db, 'notifications', notif.id), { isRead: true });
                        
                        // Update local state
                        setNotifications(prev => prev.map(n => 
                          n.id === notif.id ? { ...n, read: true } : n
                        ));
                        
                        // Update unread count
                        setUnreadCount((prev: number) => Math.max(0, prev - 1));
                      } catch (error) {
                        console.error('Error marking notification as read:', error);
                      }
                      
                      setIsOpen(false);
                    }}
                  >
                    {notif.message}
                  </Link>
                  <div className="text-xs text-gray-400 mt-1">{notif.timestamp.toLocaleString()}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center justify-between px-2 pt-2 mt-2 border-t border-gray-100">
        <button
          className="text-xs text-gray-500 hover:text-indigo-600 focus:text-indigo-600"
          onClick={() => setIsOpen(false)}
        >
          Close
        </button>
        <button
          className="text-xs text-indigo-600 hover:underline focus:underline"
          onClick={async () => {
            setViewAllOpen(true);
            await fetchAllNotifications();
          }}
        >
          View all
        </button>
      </div>
      {/* View All Modal */}
      {viewAllOpen && (
        <div className="fixed inset-0 min-h-screen z-[1000] flex items-center justify-center bg-black/60 transition-all">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 flex flex-col animate-popup">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-indigo-600 transition"
              onClick={() => setViewAllOpen(false)}
              aria-label="Close"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold mb-4 text-center">All Notifications</h2>
            {allLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-400">
                <span className="animate-spin h-5 w-5 border-2 border-indigo-400 border-t-transparent rounded-full mr-2"></span>
                Loading...
              </div>
            ) : allNotifications.length === 0 ? (
              <div className="py-8 text-center text-gray-400">No notifications</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {allNotifications.map((notif) => (
                  <li key={notif.id} className={`flex items-start gap-3 px-2 py-3 hover:bg-indigo-50 rounded-lg transition ${notif.read ? '' : 'bg-indigo-50/50'}`}>
                    <div className="flex-shrink-0 mt-1">{notif.icon}</div>
                    <div className="flex-1 min-w-0">
                      <Link href={notif.link} className="block text-sm text-gray-900 font-medium truncate hover:underline" onClick={() => { setViewAllOpen(false); setIsOpen(false); }}>
                        {notif.message}
                      </Link>
                      <div className="text-xs text-gray-400 mt-1">{notif.timestamp.toLocaleString()}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}