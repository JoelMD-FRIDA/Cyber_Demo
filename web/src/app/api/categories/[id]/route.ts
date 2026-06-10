import { NextRequest, NextResponse } from 'next/server';
import { db, domainCheckCategories } from '@/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';

// GET /api/categories/[id] - Get category detail (public)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [category] = await db
    .select()
    .from(domainCheckCategories)
    .where(eq(domainCheckCategories.id, id));

  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  return NextResponse.json({ category });
}

// PUT /api/categories/[id] - Update category (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, description } = body;

  const [existing] = await db
    .select()
    .from(domainCheckCategories)
    .where(eq(domainCheckCategories.id, id));

  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;

  const [updated] = await db
    .update(domainCheckCategories)
    .set(updateData)
    .where(eq(domainCheckCategories.id, id))
    .returning();

  return NextResponse.json({ category: updated });
}

// DELETE /api/categories/[id] - Delete category (admin only)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(_request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(domainCheckCategories)
    .where(eq(domainCheckCategories.id, id));

  if (!existing) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  await db
    .delete(domainCheckCategories)
    .where(eq(domainCheckCategories.id, id));

  return NextResponse.json({ message: 'Category deleted' });
}
