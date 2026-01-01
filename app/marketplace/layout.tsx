'use client';

import { ReactNode } from 'react';
import Header from '../components/Header';

export default function MarketplaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      {children}
    </div>
  );
} 