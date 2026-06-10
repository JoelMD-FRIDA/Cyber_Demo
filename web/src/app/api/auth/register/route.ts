import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, users, activationRequests, registrationKeys } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import { sendWithTemplate } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstname, lastname, company, username, registrationCode } = body;

    if (!email || !password || !firstname || !lastname) {
      return NextResponse.json(
        { error: 'Email, password, firstname, and lastname are required' },
        { status: 400 },
      );
    }

    const trimmedEmail = email.toLowerCase().trim();
    const trimmedUsername = username?.trim() || null;

    // Check duplicate email
    const existingEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, trimmedEmail))
      .limit(1);

    if (existingEmail.length > 0) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    // Check duplicate username (if provided)
    if (trimmedUsername) {
      const existingUsername = await db
        .select()
        .from(users)
        .where(eq(users.username, trimmedUsername))
        .limit(1);

      if (existingUsername.length > 0) {
        return NextResponse.json(
          { error: 'This username is already taken' },
          { status: 409 },
        );
      }
    }

    // Validate registration key if provided
    let resolvedCompany = company || null;
    if (registrationCode) {
      const keyRecord = await db
        .select()
        .from(registrationKeys)
        .where(eq(registrationKeys.code, registrationCode))
        .limit(1);

      if (keyRecord.length === 0) {
        return NextResponse.json(
          { error: 'Invalid registration key. Please check your key and try again.' },
          { status: 400 },
        );
      }

      const key = keyRecord[0];

      // Check if key is expired
      if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
        return NextResponse.json(
          { error: 'This registration key has expired. Please contact your administrator.' },
          { status: 400 },
        );
      }

      // Check if key is enabled
      if (!key.enabled) {
        return NextResponse.json(
          { error: 'This registration key has been disabled. Please contact your administrator.' },
          { status: 400 },
        );
      }

      // Check if key has available slots
      if (key.usedCount >= key.totalSlots) {
        return NextResponse.json(
          { error: 'This registration key has reached its maximum number of uses. Please contact your administrator.' },
          { status: 400 },
        );
      }

      // Resolve company from key if not provided
      if (!resolvedCompany && key.company) {
        resolvedCompany = key.company;
      }
    }

    const passwordHash = await hashPassword(password);
    const fullname = `${firstname} ${lastname}`;

    const smtpConfigured = !!(process.env.SMTP_HOST);
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        username: trimmedUsername,
        passwordHash,
        firstname,
        lastname,
        company: resolvedCompany,
        isActivated: !smtpConfigured,
        role: 'user',
      })
      .returning();

    // Increment usedCount if registration key was provided
    if (registrationCode) {
      await db
        .update(registrationKeys)
        .set({ usedCount: sql`${registrationKeys.usedCount} + 1` })
        .where(eq(registrationKeys.code, registrationCode));
    }

    if (smtpConfigured) {
      const activationToken = crypto.randomUUID();
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const confirmationLink = `${baseUrl}/activate/${activationToken}`;

      await db.insert(activationRequests).values({
        uuid: activationToken,
        fullname,
        email: newUser.email,
        confirmationLink,
      });

      try {
        const result = await sendWithTemplate(
          newUser.email,
          'registration',
          {
            username: fullname,
            confirmationLink,
          },
          'de',
        );
        if (result.queued) {
          console.warn('Registration email queued for later delivery');
        }
      } catch (e) {
        console.warn('Registration email sending failed:', e instanceof Error ? e.message : e);
      }
    }

    return NextResponse.json(
      {
        message: 'Registration successful. Please check your email to activate your account.',
        userId: newUser.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
