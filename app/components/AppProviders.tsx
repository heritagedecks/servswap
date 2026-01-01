'use client';
import { AuthProvider } from '../context/AuthContext';
import LogoRefProvider from './LogoRefProvider';
import ChatSupport from './ChatSupport';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <LogoRefProvider>
        {children}
        <ChatSupport />
      </LogoRefProvider>
    </AuthProvider>
  );
} 