export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const headersObj: Record<string, string> = {};
  for (const [key, value] of request.headers.entries()) {
    headersObj[key] = value;
  }
  return NextResponse.json({ headers: headersObj });
} 