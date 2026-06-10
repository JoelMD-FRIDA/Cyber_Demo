import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME } from './lib/auth.constants';
import { verifySessionToken } from './lib/auth-edge';
import { canAccessRoute, Role } from './lib/rbac';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/activate', '/impressum', '/datenschutz', '/unauthorized'];
const API_AUTH_PREFIX = '/api/auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPrefetch =
    request.headers.get('next-router-prefetch') === '1' ||
    request.headers.get('purpose') === 'prefetch';

  if (
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route + '/')) ||
    pathname.startsWith(API_AUTH_PREFIX)
  ) {
    return NextResponse.next();
  }

  // Next.js prefetch requests do not always carry the session cookie.
  // Redirecting those speculative requests to /login poisons the router cache
  // and makes authenticated navigation look like a logout.
  if (isPrefetch) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  console.log('Middleware: Token from cookie:', token ? 'present' : 'absent');
  
  const session = token ? await verifySessionToken(token) : null;
  console.log('Middleware: Session from token:', session ? 'present' : 'absent');

  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    console.log('Middleware: Redirecting to login');
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith('/admin') && session.role !== Role.ADMIN) {
    console.log('Middleware: Redirecting to unauthorized (admin check)');
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  if (!canAccessRoute(session.role as Role | null, pathname)) {
    console.log('Middleware: Redirecting to unauthorized (route access check)');
    return NextResponse.redirect(new URL('/unauthorized', request.url));
  }

  console.log('Middleware: Allowing access to', pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
