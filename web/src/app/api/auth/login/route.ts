import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';

function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = typeof body.identifier === 'string'
      ? body.identifier.trim()
      : typeof body.email === 'string'
        ? body.email.trim()
        : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!identifier || !password) throw new ApiError('INVALID_INPUT', 'Email/username and password are required.');

    let email = identifier.toLowerCase();
    if (!identifier.includes('@')) {
      const admin = createSupabaseAdminClient();
      const { data: profile, error } = await admin.from('profiles').select('email').eq('username', identifier.toLowerCase()).maybeSingle();
      if (error || !profile) throw new ApiError('UNAUTHORIZED', 'Invalid email/username or password.', 401);
      email = profile.email;
    }

    const { supabase, getResponse } = createSupabaseRouteClient(request);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      if (error?.code === 'email_not_confirmed') {
        throw new ApiError('EMAIL_NOT_CONFIRMED', 'Please confirm your email address before signing in.', 401);
      }
      throw new ApiError('UNAUTHORIZED', 'Invalid email/username or password.', 401);
    }

    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin.from('profiles').select('*').eq('id', data.user.id).maybeSingle();
    if (!profile) throw new ApiError('UNAUTHORIZED', 'The account profile is not available.', 401);

    const result = NextResponse.json({
      id: data.user.id,
      email: profile.email,
      username: profile.username,
      firstname: profile.firstname,
      lastname: profile.lastname,
      role: profile.role,
    });
    copyCookies(getResponse(), result);
    return result;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
