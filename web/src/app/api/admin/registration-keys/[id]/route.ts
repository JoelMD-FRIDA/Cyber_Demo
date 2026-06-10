import { NextRequest, NextResponse } from 'next/server';
import { db, registrationKeys } from '@/db';
import { eq } from 'drizzle-orm';
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

async function findKey(id: string) {
  const result = await db
    .select()
    .from(registrationKeys)
    .where(eq(registrationKeys.id, id))
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
  const key = await findKey(id);

  if (!key) {
    return NextResponse.json({ error: 'Registration key not found' }, { status: 404 });
  }

  return NextResponse.json({ key });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const key = await findKey(id);

  if (!key) {
    return NextResponse.json({ error: 'Registration key not found' }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if ('code' in body) {
    if (body.code !== key.code) {
      const existing = await db
        .select()
        .from(registrationKeys)
        .where(eq(registrationKeys.code, body.code))
        .limit(1);
      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'A registration key with this code already exists' },
          { status: 409 },
        );
      }
    }
    updateData.code = body.code;
  }
  if ('company' in body) updateData.company = body.company || null;
  if ('companyDomain' in body) updateData.companyDomain = body.companyDomain || null;
  if ('totalSlots' in body) {
    if (body.totalSlots < 1) {
      return NextResponse.json(
        { error: 'totalSlots must be at least 1' },
        { status: 400 },
      );
    }
    updateData.totalSlots = body.totalSlots;
  }
  if ('enabled' in body) updateData.enabled = body.enabled;
  if ('expiresAt' in body) {
    updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ key });
  }

  const [updatedKey] = await db
    .update(registrationKeys)
    .set(updateData)
    .where(eq(registrationKeys.id, id))
    .returning();

  return NextResponse.json({ key: updatedKey });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const key = await findKey(id);

  if (!key) {
    return NextResponse.json({ error: 'Registration key not found' }, { status: 404 });
  }

  await db
    .delete(registrationKeys)
    .where(eq(registrationKeys.id, id));

  return NextResponse.json({ message: 'Registration key deleted' });
}
