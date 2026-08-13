import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ApiError, apiErrorResponse, type ApiErrorCode } from '@/lib/api-errors';

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

    const supabase = await createSupabaseServerClient();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { firstname, lastname, username, company },
      },
    });
    if (signUpError || !signUpData.user) {
      throw new ApiError('INVALID_INPUT', signUpError?.message ?? 'Unable to create the account.', 400);
    }

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

    return NextResponse.json({
      message: signUpData.session
        ? 'Registration successful. You can now sign in.'
        : 'Registration successful. Please check your email to confirm your account.',
      confirmationRequired: !signUpData.session,
    }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
