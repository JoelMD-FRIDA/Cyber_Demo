import { NextRequest, NextResponse } from 'next/server';
import { eq, or, and, isNull } from 'drizzle-orm';
import { db, users } from '@/db';
import { verifyPassword } from '@/lib/auth';
import { setSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, username: bodyUsername } = body;
    const identifier = bodyUsername || email;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: 'Email/username and password are required' },
        { status: 400 },
      );
    }

    // Query by email OR username (Mendix SignIn parity)
    const trimmedIdentifier = identifier.trim();
    const lookupEmail = trimmedIdentifier.toLowerCase();
    const userList = await db
      .select()
      .from(users)
      .where(
        and(
          isNull(users.deletedAt),
          or(
            eq(users.email, lookupEmail),
            eq(users.username, trimmedIdentifier),
          ),
        ),
      )
      .limit(2);

    if (userList.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 },
      );
    }

    // Ambiguity check: if both email and username matched different users, reject
    if (userList.length > 1) {
      const emailMatch = userList.find((u) => u.email === lookupEmail);
      const usernameMatch = userList.find((u) => u.username === trimmedIdentifier);
      if (emailMatch && usernameMatch && emailMatch.id !== usernameMatch.id) {
        return NextResponse.json(
          { error: 'Ambiguous identifier. Please use your email address.' },
          { status: 409 },
        );
      }
    }

    const user = userList[0];

    if (!user.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 },
      );
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid email/username or password' },
        { status: 401 },
      );
    }

    if (!user.isActivated) {
      return NextResponse.json(
        { error: 'Account not activated. Please check your email.' },
        { status: 403 },
      );
    }

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      username: user.username,
      firstname: user.firstname,
      lastname: user.lastname,
      role: user.role,
    });

    setSession(response, {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
