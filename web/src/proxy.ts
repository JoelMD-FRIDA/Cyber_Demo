import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, CSRF_COOKIE, RENEWAL_COOKIE, sessionForCookie, appOrigin, hash, equal } from '@/lib/auth/session';
import { hasRenewalContext } from '@/lib/auth/oidc';

const PUBLIC = new Set(['/', '/login', '/api/auth/login', '/auth/callback', '/auth/renew/complete', '/impressum', '/datenschutz', '/unauthorized', '/api/health/live', '/api/health/ready', '/api/auth/register']);
// These routes render empty client shells; their APIs still require current authorization.
const RESUMABLE = new Set(['/dashboard/domain-check','/profile','/admin','/admin/categories','/admin/providers','/admin/registration-keys','/admin/users']);
const RETIRED = new Set(['/register', '/forgot-password', '/reset-password']);
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (RETIRED.has(path)) return NextResponse.redirect(new URL('/login',appOrigin()));
  if (PUBLIC.has(path) || path==='/api/cron/process-domain-checks' || path==='/api/internal/deployment-probe') return NextResponse.next();
  // Static public assets carry no personal/business records.
  if (/^\/(favicon\.ico|frida-logo\.svg|frida-icon\.png|logo\.png|icon-\d+\.png|apple-touch-icon\.png|robots\.txt)$/.test(path)) return NextResponse.next();
  try {
    const session = request.headers.has('authorization') ? null : await sessionForCookie(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      if (path.startsWith('/api/')) return NextResponse.json({ code:'UNAUTHORIZED',error:'Authentication is required.' },{ status:401 });
      if ((RESUMABLE.has(path)||/^\/dashboard\/domain-check\/results\/[a-f0-9-]{36}$/.test(path)) &&
          hasRenewalContext(request.cookies.get(RENEWAL_COOKIE)?.value)) {
        const response=NextResponse.next();response.headers.set('Cache-Control','private, no-store');return response;
      }
      const login = new URL('/login',appOrigin());login.searchParams.set('redirect',path+request.nextUrl.search);
      return NextResponse.redirect(login);
    }
    if (path.startsWith('/admin') && session.profile.role!=='admin') return NextResponse.redirect(new URL('/unauthorized',appOrigin()));
    if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
      const token = request.headers.get('x-frida-csrf');
      if (request.headers.get('origin')!==appOrigin() || !equal(token,request.cookies.get(CSRF_COOKIE)?.value) || !token || !equal(hash(token),session.csrfHash))
        return NextResponse.json({ code:'FORBIDDEN',error:'Request verification failed.' },{ status:403 });
    }
    const response=NextResponse.next();
    if(path.startsWith('/api/')||path.startsWith('/auth/'))response.headers.set('Cache-Control','private, no-store');
    return response;
  } catch {
    return NextResponse.json({ error:'Application is temporarily unavailable.' },{ status:503 });
  }
}
export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
