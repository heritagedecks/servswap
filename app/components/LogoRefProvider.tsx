'use client';
import React, { useRef } from 'react';
import { LogoRefContext } from './Header';

export default function LogoRefProvider({ children }: { children: React.ReactNode }) {
  const logoRef = useRef<HTMLImageElement | null>(null);
  return (
    <LogoRefContext.Provider value={logoRef}>
      {children}
    </LogoRefContext.Provider>
  );
} 