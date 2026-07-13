import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users, forgotPasswordRequests } from '@/db';
import { generateResetToken } from '@/lib/auth';
import { sendWithTemplate } from '@/lib/email';
import { getPublicBaseUrl } from '@/lib/runtime-env';

const RESET_TOKEN_EXPIRY_HOURS = 1;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        { message: 'If an account exists with this email, a reset link has been sent.' },
        { status: 200 },
      );
    }

    const resetToken = generateResetToken();
    const validUntil = new Date();
    validUntil.setHours(validUntil.getHours() + RESET_TOKEN_EXPIRY_HOURS);

    const baseUrl = getPublicBaseUrl();
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;

    const fullname = [user.firstname, user.lastname].filter(Boolean).join(' ') || user.email;

    await db.insert(forgotPasswordRequests).values({
      emailAddress: user.email,
      username: user.email,
      userFullName: fullname,
      guid: resetToken,
      url: resetLink,
      validUntil,
      isSignup: false,
    });

    const result = await sendWithTemplate(
      user.email,
      'forgot-password',
      {
        username: fullname,
        resetLink,
      },
      'de',
    );

    if (result.queued) {
      console.warn('Password reset email queued for later delivery');
    }

    return NextResponse.json(
      { message: 'If an account exists with this email, a reset link has been sent.' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
