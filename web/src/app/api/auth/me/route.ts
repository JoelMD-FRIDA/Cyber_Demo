import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { getAuthenticatedContext, mapProfile } from '@/lib/auth/guards';
import { cookies } from 'next/headers';
import { renewalForActiveSession } from '@/lib/auth/oidc';
import { RENEWAL_COOKIE,RENEWAL_COOKIE_SECONDS,cookieOptions,SESSION_COOKIE,CSRF_COOKIE,hash,equal,extendActiveSession,sessionForCookie } from '@/lib/auth/session';

export async function GET() {
  try {
    const context = await getAuthenticatedContext();
    if (!context) return NextResponse.json({ error: 'Authentication is required.', code: 'UNAUTHORIZED' }, { status: 401 });
    const jar=await cookies();
    const session=jar.get(SESSION_COOKIE)?.value;
    if(!session)return NextResponse.json({code:'UNAUTHORIZED'},{status:401});
    const expiresAt=await extendActiveSession(session,context.sessionExpiresAt);
    if(!expiresAt)return NextResponse.json({code:'UNAUTHORIZED'},{status:401});
    const renewal=await renewalForActiveSession(context.user.id,jar.get(RENEWAL_COOKIE)?.value);
    const response=NextResponse.json(mapProfile(context.profile, context.user),{headers:{
      'Cache-Control':'private, no-store','X-Frida-Session-TTL':String(Math.max(0,expiresAt-Date.now()))}});
    const maxAge=Math.max(0,Math.floor((expiresAt-Date.now())/1000));
    response.cookies.set(SESSION_COOKIE,session,{...cookieOptions,maxAge});
    const csrf=jar.get(CSRF_COOKIE)?.value;
    if(csrf) {
      const active=await sessionForCookie(session);
      if(active&&equal(hash(csrf),active.csrfHash))response.cookies.set(CSRF_COOKIE,csrf,{...cookieOptions,httpOnly:false,sameSite:'strict',maxAge});
    }
    if(renewal)response.cookies.set(RENEWAL_COOKIE,renewal,{...cookieOptions,maxAge:RENEWAL_COOKIE_SECONDS});
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
