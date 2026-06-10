import { NextRequest, NextResponse } from 'next/server';
import { generateJWT, verifyJWT } from './auth';
import { COOKIE_NAME, MAX_AGE } from './auth.constants';

export interface SessionUser {
  id: string;
  email: string;
  username: string | null;
  role: string;
}

export function setSession(
  response: NextResponse,
  user: { id: string; email: string; username: string | null; role: string },
): void {
  const token = generateJWT(user);
  const isSecure = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_BASE_URL?.startsWith('https');
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
}

export function clearSession(response: NextResponse): void {
  const isSecure = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_BASE_URL?.startsWith('https');
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export async function getSession(
  request: NextRequest,
): Promise<SessionUser | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    return await verifyJWT(token);
  } catch {
    return null;
  }
}
