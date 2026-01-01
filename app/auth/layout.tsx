'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Header from '../components/Header';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
} 