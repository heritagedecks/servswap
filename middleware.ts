import { NextRequest, NextResponse } from 'next/server';

// Temporarily disable all authentication checks
export async function middleware(request: NextRequest) {
  // For testing, allow all requests to dashboard
      return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
  ],
}; 