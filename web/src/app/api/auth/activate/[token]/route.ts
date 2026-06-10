import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users, activationRequests } from '@/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Activation token is required' },
        { status: 400 },
      );
    }

    const [activationRequest] = await db
      .select()
      .from(activationRequests)
      .where(eq(activationRequests.uuid, token))
      .limit(1);

    if (!activationRequest) {
      return NextResponse.json(
        { error: 'Invalid or expired activation token' },
        { status: 404 },
      );
    }

    // Check if token is older than 24 hours
    const createdAt = new Date(activationRequest.createdAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

    if (hoursDiff > 24) {
      return NextResponse.json(
        { error: 'Activation token has expired. Please register again.' },
        { status: 410 },
      );
    }

    await db
      .update(users)
      .set({ isActivated: true, updatedAt: new Date() })
      .where(eq(users.email, activationRequest.email));

    await db
      .delete(activationRequests)
      .where(eq(activationRequests.uuid, token));

    return NextResponse.json(
      { message: 'Account activated successfully. You can now log in.' },
      { status: 200 },
    );
  } catch (error) {
    console.error('Activation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
