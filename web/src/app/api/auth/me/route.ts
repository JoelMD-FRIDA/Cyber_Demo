import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { getAuthenticatedContext, mapProfile } from '@/lib/auth/guards';
import { cookies } from 'next/headers';
import { renewalForActiveSession } from '@/lib/auth/oidc';
import { RENEWAL_COOKIE,RENEWAL_COOKIE_SECONDS,cookieOptions } from '@/lib/auth/session';

export async function GET() {
  try {
    const context = await getAuthenticatedContext();
    if (!context) return NextResponse.json({ error: 'Authentication is required.', code: 'UNAUTHORIZED' }, { status: 401 });
    const renewal=await renewalForActiveSession(context.user.id,(await cookies()).get(RENEWAL_COOKIE)?.value);
    const response=NextResponse.json(mapProfile(context.profile, context.user),{headers:{
      'Cache-Control':'private, no-store','X-Frida-Session-TTL':String(Math.max(0,context.sessionExpiresAt-Date.now()))}});
    if(renewal)response.cookies.set(RENEWAL_COOKIE,renewal,{...cookieOptions,maxAge:RENEWAL_COOKIE_SECONDS});
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
