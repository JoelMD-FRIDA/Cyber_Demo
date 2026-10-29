import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withWrites } from '@/lib/db/postgres';
import { SESSION_COOKIE, CSRF_COOKIE, RENEWAL_COOKIE, cookieOptions, hash } from '@/lib/auth/session';
export async function POST() {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (cookie) await withWrites(db=>db.query('DELETE FROM app_sessions WHERE id_hash=$1',[hash(cookie)]));
  const response = NextResponse.json({ message:'Signed out of this sandbox.' });
  for (const name of [SESSION_COOKIE,CSRF_COOKIE,RENEWAL_COOKIE]) response.cookies.set(name,'',{ ...cookieOptions,maxAge:0 });
  return response;
}
