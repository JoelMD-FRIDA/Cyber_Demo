import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';
import { hashPassword } from '@/lib/auth';

function sanitizeUser(user: typeof users.$inferSelect) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...sanitized } = user;
  return sanitized;
}

async function requireAdmin(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (session.role !== Role.ADMIN) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { session };
}

async function findActiveUser(id: string) {
  const result = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return result[0] || null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const user = await findActiveUser(id);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user: sanitizeUser(user) });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const user = await findActiveUser(id);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if ('firstname' in body) updateData.firstname = body.firstname;
  if ('lastname' in body) updateData.lastname = body.lastname;
  if ('email' in body) {
    if (body.email !== user.email) {
      const existing = await db
        .select()
        .from(users)
        .where(and(eq(users.email, body.email), isNull(users.deletedAt)))
        .limit(1);
      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'Email already exists' },
          { status: 409 },
        );
      }
    }
    updateData.email = body.email;
  }
  if ('username' in body) {
    const trimmedUsername = body.username?.trim() || null;
    if (trimmedUsername !== user.username) {
      if (trimmedUsername) {
        const existing = await db
          .select()
          .from(users)
          .where(and(eq(users.username, trimmedUsername), isNull(users.deletedAt)))
          .limit(1);
        if (existing.length > 0) {
          return NextResponse.json(
            { error: 'Username already exists' },
            { status: 409 },
          );
        }
      }
      updateData.username = trimmedUsername;
    }
  }
  if ('role' in body) {
    const validRoles = [Role.ADMIN, Role.USER];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "admin" or "user"' },
        { status: 400 },
      );
    }
    updateData.role = body.role;
  }
  if ('company' in body) updateData.company = body.company;
  if ('isActivated' in body) updateData.isActivated = body.isActivated;
  if ('password' in body && body.password) {
    updateData.passwordHash = await hashPassword(body.password);
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ user: sanitizeUser(user) });
  }

  const [updatedUser] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, id))
    .returning();

  return NextResponse.json({ user: sanitizeUser(updatedUser) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const user = await findActiveUser(id);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await db
    .delete(users)
    .where(eq(users.id, id));

  return NextResponse.json({ message: 'User deleted' });
}
