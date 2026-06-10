import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, domainCheckProviders } from '@/db';
import { and, eq, ilike } from 'drizzle-orm';
import { getSession } from '@/lib/session';

// GET /api/providers - List providers with optional filtering (public)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get('search');
  const isActive = searchParams.get('isActive');

  const conditions: ReturnType<typeof ilike>[] = [];

  if (search) {
    conditions.push(ilike(domainCheckProviders.name, `%${search}%`));
  }

  if (isActive !== null && isActive !== '') {
    const isActiveBool = isActive === 'true';
    conditions.push(eq(domainCheckProviders.isActive, isActiveBool));
  }

  const providers =
    conditions.length > 0
      ? await db
          .select()
          .from(domainCheckProviders)
          .where(and(...conditions))
      : await db.select().from(domainCheckProviders);

  return NextResponse.json({ providers });
}

// POST /api/providers - Create a new provider (requires auth)
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, isActive, description, websiteUrl, shortDescription, longDescription, apiBaseUrl } = body;

  // Validate required fields
  if (!name) {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 }
    );
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

  const [provider] = await db
    .insert(domainCheckProviders)
    .values({
      uuid: crypto.randomUUID(),
      name,
      isActive: isActive ?? true,
      description: description ?? null,
      websiteUrl: websiteUrl ?? null,
      shortDescription: shortDescription ?? null,
      longDescription: longDescription ?? null,
      apiBaseUrl: apiBaseUrl ?? null,
    })
    .returning();

  return NextResponse.json({ provider }, { status: 201 });
}
