import { NextRequest, NextResponse } from 'next/server';
import { finishLogin } from '@/lib/auth/oidc';
import { loginFailureCategory } from '@/lib/auth/login-failure';
import { SESSION_COOKIE, CSRF_COOKIE, TRANSACTION_COOKIE, SESSION_SECONDS, cookieOptions, appOrigin,
  RENEWAL_COOKIE, RENEWAL_COOKIE_SECONDS, transactionCookieName, sessionForCookie, type LoginMode } from '@/lib/auth/session';
export async function GET(request: NextRequest) {
  const state = request.nextUrl.searchParams.get('state') ?? '';
  let name = TRANSACTION_COOKIE;
  let mode: LoginMode = 'login';
  for (const candidate of ['login','silent','interactive'] as const) {
    const key = transactionCookieName(state,candidate);
    if (request.cookies.has(key)) { name = key; mode = candidate; break; }
  }
  try {
    if (request.headers.get('host')!==new URL(appOrigin()).host) throw new Error('Origin mismatch.');
    const login = await finishLogin(request.nextUrl,request.cookies.get(name)?.value);
    const response = NextResponse.redirect(new URL(login.returnPath,appOrigin()));
    response.headers.set('Cache-Control','no-store');
    response.cookies.set(name,'',{ ...cookieOptions,maxAge:0 });
    if (login.renewalCookie) response.cookies.set(RENEWAL_COOKIE,login.renewalCookie,{ ...cookieOptions,maxAge:RENEWAL_COOKIE_SECONDS });
    response.cookies.set(SESSION_COOKIE,login.session,{ ...cookieOptions,maxAge:SESSION_SECONDS });
    response.cookies.set(CSRF_COOKIE,login.csrf,{ ...cookieOptions,httpOnly:false,sameSite:'strict',maxAge:SESSION_SECONDS });
    return response;
  } catch (error) {
    const category = loginFailureCategory(error);
    // Back/reload or a duplicated callback cannot undo an already completed login.
    if (mode==='login' && category==='TRANSACTION_EXPIRED_OR_REPLACED' &&
        await sessionForCookie(request.cookies.get(SESSION_COOKIE)?.value).catch(()=>null)) {
      const response=NextResponse.redirect(new URL('/dashboard/domain-check',appOrigin()));
      response.headers.set('Cache-Control','no-store');
      response.cookies.set(name,'',{...cookieOptions,maxAge:0});
      return response;
    }
    // Log only a fixed category: OAuth codes, tokens, emails and raw exceptions stay private.
    console.warn('FRIDA_LOGIN_FAILED', category);
    const target = mode === 'login' ? '/login?error=signin_failed' : '/auth/renew/complete?error=1'+(mode==='interactive'?'&popup=1':'');
    const response = NextResponse.redirect(new URL(target,appOrigin()));
    response.headers.set('Cache-Control','no-store');
    response.cookies.set(name,'',{ ...cookieOptions,maxAge:0 });
    return response;
  }
}
