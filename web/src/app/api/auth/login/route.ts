import { NextRequest, NextResponse } from 'next/server';
import { startLogin } from '@/lib/auth/oidc';
import { TRANSACTION_COOKIE, cookieOptions, appOrigin } from '@/lib/auth/session';
export async function GET(request: NextRequest) {
  try {
    if (request.headers.get('host')!==new URL(appOrigin()).host) throw new Error('Origin mismatch.');
    const login = await startLogin(request.nextUrl.searchParams.get('redirect'));
    const response = NextResponse.redirect(login.url);
    response.headers.set('Cache-Control','no-store');
    response.cookies.set(TRANSACTION_COOKIE,login.transaction,{ ...cookieOptions,maxAge:300 });
    return response;
  } catch { return NextResponse.json({ error:'Central login is temporarily unavailable.' },{ status:503 }); }
}
export async function POST() { return NextResponse.json({ error:'Use central sign-in.' },{ status:410 }); }
