import { NextRequest, NextResponse } from 'next/server';
import { finishLogin } from '@/lib/auth/oidc';
import { SESSION_COOKIE, CSRF_COOKIE, TRANSACTION_COOKIE, SESSION_SECONDS, cookieOptions, appOrigin } from '@/lib/auth/session';
export async function GET(request: NextRequest) {
  try {
    if (request.headers.get('host')!==new URL(appOrigin()).host) throw new Error('Origin mismatch.');
    const login = await finishLogin(request.nextUrl,request.cookies.get(TRANSACTION_COOKIE)?.value);
    const response = NextResponse.redirect(new URL(login.returnPath,appOrigin()));
    response.headers.set('Cache-Control','no-store');
    response.cookies.set(TRANSACTION_COOKIE,'',{ ...cookieOptions,maxAge:0 });
    response.cookies.set(SESSION_COOKIE,login.session,{ ...cookieOptions,maxAge:SESSION_SECONDS });
    response.cookies.set(CSRF_COOKIE,login.csrf,{ ...cookieOptions,httpOnly:false,sameSite:'strict',maxAge:SESSION_SECONDS });
    return response;
  } catch {
    const response = NextResponse.json({ error:'Sign-in could not be completed.' },{ status:401 });
    response.cookies.set(TRANSACTION_COOKIE,'',{ ...cookieOptions,maxAge:0 });
    return response;
  }
}
