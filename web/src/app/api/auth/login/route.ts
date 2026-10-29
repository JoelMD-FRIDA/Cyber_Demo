import { NextRequest, NextResponse } from 'next/server';
import { startLogin } from '@/lib/auth/oidc';
import { cookieOptions, appOrigin, RENEWAL_COOKIE, transactionCookieName, type LoginMode } from '@/lib/auth/session';
export async function GET(request: NextRequest) {
  try {
    if (request.headers.get('host')!==new URL(appOrigin()).host) throw new Error('Origin mismatch.');
    const renew = request.nextUrl.searchParams.get('renew');
    if (renew && renew !== 'silent' && renew !== 'interactive') throw new Error('Unknown login mode.');
    const mode: LoginMode = renew === 'silent' || renew === 'interactive' ? renew : 'login';
    const login = await startLogin(request.nextUrl.searchParams.get('redirect'), renew ? {
      cookie: request.cookies.get(RENEWAL_COOKIE)?.value, interactive: renew === 'interactive',
    } : undefined);
    const response = NextResponse.redirect(login.url);
    response.headers.set('Cache-Control','no-store');
    // Concurrent tabs and renewal requests must not replace each other's PKCE transaction.
    response.cookies.set(transactionCookieName(login.url.searchParams.get('state')!, mode),login.transaction,{ ...cookieOptions,maxAge:300 });
    return response;
  } catch { return NextResponse.json({ error:'Central login is temporarily unavailable.' },{ status:503 }); }
}
export async function POST() { return NextResponse.json({ error:'Use central sign-in.' },{ status:410 }); }
