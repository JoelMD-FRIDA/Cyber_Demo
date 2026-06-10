import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db, domainCheckCategories } from '@/db';
import { getSession } from '@/lib/session';

// GET /api/categories - List all categories (public)
export async function GET() {
  const categories = await db.select().from(domainCheckCategories);
  return NextResponse.json({ categories });
}

// POST /api/categories - Create a new category (requires auth)
export async function POST(request: NextRequest) {
  const session = await getSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { name, description } = body;

  if (!name) {
    return NextResponse.json(
      { error: 'name is required' },
      { status: 400 }
    );
  }

  const [category] = await db
    .insert(domainCheckCategories)
    .values({
      uuid: crypto.randomUUID(),
      name,
      description: description ?? null,
    })
    .returning();

  return NextResponse.json({ category }, { status: 201 });
}
