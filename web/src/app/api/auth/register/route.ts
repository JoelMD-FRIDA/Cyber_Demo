import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseRouteClient } from '@/lib/supabase/route';
import { ApiError, apiErrorResponse, type ApiErrorCode } from '@/lib/api-errors';

type SupabaseAuthErrorLike = {
  name?: unknown;
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

function toSupabaseAuthError(error: unknown): ApiError {
  const authError = (error && typeof error === 'object' ? error : {}) as SupabaseAuthErrorLike;
  const status = typeof authError.status === 'number' ? authError.status : undefined;
  const name = typeof authError.name === 'string' ? authError.name : undefined;
  const code = typeof authError.code === 'string' ? authError.code : undefined;
  const message = typeof authError.message === 'string' ? authError.message : 'Unable to create the account.';

  if ((status !== undefined && status >= 500) || name === 'AuthRetryableFetchError') {
    console.error('Supabase Auth signup unavailable', { status, name, code });
    return new ApiError(
      'AUTH_PROVIDER_UNAVAILABLE',
      'The registration service is temporarily unavailable. Please try again later.',
      503,
    );
  }

  return new ApiError('INVALID_INPUT', message, 400);
}

function copyCookies(from: NextResponse, to: NextResponse): void {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const firstname = typeof body.firstname === 'string' ? body.firstname.trim() : '';
    const lastname = typeof body.lastname === 'string' ? body.lastname.trim() : '';
    const username = typeof body.username === 'string' && body.username.trim() ? body.username.trim().toLowerCase() : null;
    const company = typeof body.company === 'string' && body.company.trim() ? body.company.trim() : null;
    const registrationCode = typeof body.registrationCode === 'string' && body.registrationCode.trim()
      ? body.registrationCode.trim()
      : null;

    if (!email || !password || !firstname || !lastname) {
      throw new ApiError('INVALID_INPUT', 'Email, password, first name, and last name are required.');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new ApiError('INVALID_INPUT', 'A valid email address is required.');
    }
    if (password.length < 8) {
      throw new ApiError('INVALID_INPUT', 'Password must be at least 8 characters long.');
    }

    const admin = createSupabaseAdminClient();
    const { data: existingEmail } = await admin.from('profiles').select('id').eq('email', email).maybeSingle();
    if (existingEmail) throw new ApiError('CONFLICT', 'An account with this email already exists.', 409);
    if (username) {
      const { data: existingUsername } = await admin.from('profiles').select('id').eq('username', username).maybeSingle();
      if (existingUsername) throw new ApiError('CONFLICT', 'This username is already taken.', 409);
    }

    const { supabase, getResponse } = createSupabaseRouteClient(request);
    let signUpData: Awaited<ReturnType<typeof supabase.auth.signUp>>['data'];
    try {
      const signUpResult = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { firstname, lastname, username, company },
        },
      });
      if (signUpResult.error) throw toSupabaseAuthError(signUpResult.error);
      signUpData = signUpResult.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw toSupabaseAuthError(error);
    }
    if (!signUpData.user) throw new ApiError('INTERNAL_ERROR', 'Unable to create the account.', 500);

    try {
      if (registrationCode) {
        const { error: keyError } = await admin.rpc('reserve_registration_key', { p_code: registrationCode });
        if (keyError) throw new Error(keyError.message);
      }
    } catch (error) {
      await admin.auth.admin.deleteUser(signUpData.user.id);
      const code = error instanceof Error ? error.message.trim() : '';
      const keyMessages: Record<string, [ApiErrorCode, string]> = {
        REGISTRATION_KEY_NOT_FOUND: ['REGISTRATION_KEY_NOT_FOUND', 'The registration key is invalid.'],
        REGISTRATION_KEY_DISABLED: ['REGISTRATION_KEY_DISABLED', 'The registration key is disabled.'],
        REGISTRATION_KEY_EXPIRED: ['REGISTRATION_KEY_EXPIRED', 'The registration key has expired.'],
        REGISTRATION_KEY_EXHAUSTED: ['REGISTRATION_KEY_EXHAUSTED', 'The registration key has no available slots.'],
      };
      const [keyCode, message] = keyMessages[code] ?? ['INVALID_INPUT', 'The registration key is invalid.'];
      throw new ApiError(keyCode, message, 400);
    }

    const response = NextResponse.json({
      message: signUpData.session
        ? 'Registration successful. You can now sign in.'
        : 'Registration successful. Please check your email to confirm your account.',
      confirmationRequired: !signUpData.session,
    }, { status: 201 });
    copyCookies(getResponse(), response);
    return response;
  } catch (error) {
    return apiErrorResponse(error);
  }
}
