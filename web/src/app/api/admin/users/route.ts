import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/db';
import { eq, ilike, count, and, isNull } from 'drizzle-orm';
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

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
  const search = searchParams.get('search') || '';
  const offset = (page - 1) * limit;

  const whereClause = and(
    isNull(users.deletedAt),
    search
      ? ilike(users.email, `%${search}%`)
      : undefined,
  );

  const [{ total }] = await db
    .select({ total: count() })
    .from(users)
    .where(whereClause);

  const userList = await db
    .select()
    .from(users)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(users.createdAt);

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    users: userList.map(sanitizeUser),
    total,
    page,
    limit,
    totalPages,
  });
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const body = await request.json();
  const { email, password, firstname, lastname, role, company, username } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'email and password are required' },
      { status: 400 },
    );
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { error: 'Invalid email format' },
      { status: 400 },
    );
  }

  const validRoles = [Role.ADMIN, Role.USER];
  const userRole = role || Role.USER;
  if (!validRoles.includes(userRole)) {
    return NextResponse.json(
      { error: 'Invalid role. Must be "admin" or "user"' },
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
      { error: 'Email already exists' },
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
        { error: 'Username already exists' },
        { status: 409 },
      );
    }
  }

  const passwordHash = await hashPassword(password);

  const [newUser] = await db
    .insert(users)
    .values({
      email: trimmedEmail,
      username: trimmedUsername,
      passwordHash,
      firstname: firstname || null,
      lastname: lastname || null,
      role: userRole,
      company: company || null,
      isActivated: body.isActivated !== undefined ? body.isActivated : true,
    })
    .returning();

  return NextResponse.json({ user: sanitizeUser(newUser) }, { status: 201 });
}
