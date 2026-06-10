import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function POST() {
  const response = NextResponse.json(
    { message: 'Logged out successfully' },
    { status: 200 },
  );

  clearSession(response);

  return response;
}
