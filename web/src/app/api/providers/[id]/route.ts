import { NextRequest, NextResponse } from 'next/server';
import { db, domainCheckProviders } from '@/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';

// GET /api/providers/[id] - Get provider detail (public)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [provider] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.id, id));

  if (!provider) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  return NextResponse.json({ provider });
}

// PUT /api/providers/[id] - Update provider (admin only)
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
  const { name, isActive, description, websiteUrl, shortDescription, longDescription, apiBaseUrl } = body;

  // Check provider exists
  const [existing] = await db
    .select()
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.id, id));

  if (!existing) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  if (websiteUrl) {
    try {
      new URL(websiteUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid website URL format' },
        { status: 400 }
      );
    }
  }

  if (apiBaseUrl) {
    try {
      new URL(apiBaseUrl);
    } catch {
      return NextResponse.json(
        { error: 'Invalid API base URL format' },
        { status: 400 }
      );
    }
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (isActive !== undefined) updateData.isActive = isActive;
  if (description !== undefined) updateData.description = description;
  if (websiteUrl !== undefined) updateData.websiteUrl = websiteUrl;
  if (shortDescription !== undefined) updateData.shortDescription = shortDescription;
  if (longDescription !== undefined) updateData.longDescription = longDescription;
  if (apiBaseUrl !== undefined) updateData.apiBaseUrl = apiBaseUrl;

  const [updated] = await db
    .update(domainCheckProviders)
    .set(updateData)
    .where(eq(domainCheckProviders.id, id))
    .returning();

  return NextResponse.json({ provider: updated });
}

// DELETE /api/providers/[id] - Delete provider (admin only)
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
    .from(domainCheckProviders)
    .where(eq(domainCheckProviders.id, id));

  if (!existing) {
    return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
  }

  await db
    .delete(domainCheckProviders)
    .where(eq(domainCheckProviders.id, id));

  return NextResponse.json({ message: 'Provider deleted' });
}
