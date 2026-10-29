import { NextRequest, NextResponse } from 'next/server';
import { finishLogin } from '@/lib/auth/oidc';
import { SESSION_COOKIE, CSRF_COOKIE, TRANSACTION_COOKIE, SESSION_SECONDS, cookieOptions, appOrigin,
  RENEWAL_COOKIE, RENEWAL_COOKIE_SECONDS, transactionCookieName, type LoginMode } from '@/lib/auth/session';
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
    const message = error instanceof Error ? error.message : '';
    const code = error && typeof error==='object' && 'code' in error ? error.code : '';
    const category = message === 'Invalid login transaction.' || message === 'Expired or replayed login transaction.'
      ? 'TRANSACTION_EXPIRED_OR_REPLACED' : message === 'Origin mismatch.' ? 'ORIGIN_MISMATCH'
      : message === 'This identity is not authorized for the sandbox.' ? 'IDENTITY_NOT_ALLOWED'
      : message === 'This account is disabled or differs from the original session.' ? 'ACCOUNT_DISABLED_OR_CHANGED'
      : code === '23505' ? 'IDENTITY_EMAIL_CONFLICT' : 'IDENTITY_SERVICE_OR_TOKEN_VALIDATION';
    // Log only a fixed category: OAuth codes, tokens, emails and raw exceptions stay private.
    console.warn('FRIDA_LOGIN_FAILED', category);
    const target = mode === 'login' ? '/login?error=signin_failed' : '/auth/renew/complete?error=1'+(mode==='interactive'?'&popup=1':'');
    const response = NextResponse.redirect(new URL(target,appOrigin()));
    response.headers.set('Cache-Control','no-store');
    response.cookies.set(name,'',{ ...cookieOptions,maxAge:0 });
    return response;
  }
}
