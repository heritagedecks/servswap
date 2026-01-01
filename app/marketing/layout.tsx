'use client';

import { ReactNode } from 'react';
import Header from '../components/Header';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {children}
    </div>
  );
} 