import { NextRequest, NextResponse } from 'next/server';
import { db, registrationKeys } from '@/db';
import { eq, ilike, count, and } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';

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

  const whereClause = search
    ? and(ilike(registrationKeys.code, `%${search}%`))
    : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(registrationKeys)
    .where(whereClause);

  const keys = await db
    .select()
    .from(registrationKeys)
    .where(whereClause)
    .limit(limit)
    .offset(offset)
    .orderBy(registrationKeys.createdAt);

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    keys,
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
  const { code, company, companyDomain, totalSlots, enabled, expiresAt } = body;

  if (!code) {
    return NextResponse.json(
      { error: 'code is required' },
      { status: 400 },
    );
  }

  if (!totalSlots || totalSlots < 1) {
    return NextResponse.json(
      { error: 'totalSlots must be at least 1' },
      { status: 400 },
    );
  }

  // Check duplicate code
  const existing = await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.code, code))
    .limit(1);

  if (existing.length > 0) {
    return NextResponse.json(
      { error: 'A registration key with this code already exists' },
      { status: 409 },
    );
  }

  const [newKey] = await db
    .insert(registrationKeys)
    .values({
      code,
      company: company || null,
      companyDomain: companyDomain || null,
      totalSlots,
      enabled: enabled !== undefined ? enabled : true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      usedCount: 0,
    })
    .returning();

  return NextResponse.json({ key: newKey }, { status: 201 });
}
