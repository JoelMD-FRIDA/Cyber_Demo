import { NextRequest, NextResponse } from 'next/server';
import { db, apiCredentials } from '@/db';
import { count } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';
import { encryptValue } from '@/lib/crypto';

function sanitizeCredential(credential: typeof apiCredentials.$inferSelect) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordEncrypted, ...sanitized } = credential;
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
  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: count() })
    .from(apiCredentials);

  const credentialList = await db
    .select()
    .from(apiCredentials)
    .limit(limit)
    .offset(offset)
    .orderBy(apiCredentials.createdAt);

  const totalPages = Math.ceil(total / limit);

  return NextResponse.json({
    credentials: credentialList.map(sanitizeCredential),
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
  const { apiUrl, oauthUrl, username, password } = body;

  if (!apiUrl) {
    return NextResponse.json(
      { error: 'apiUrl is required' },
      { status: 400 },
    );
  }

  const urlPattern = /^https?:\/\/.+/;
  if (!urlPattern.test(apiUrl)) {
    return NextResponse.json(
      { error: 'apiUrl must be a valid URL starting with http:// or https://' },
      { status: 400 },
    );
  }

  if (oauthUrl && !urlPattern.test(oauthUrl)) {
    return NextResponse.json(
      { error: 'oauthUrl must be a valid URL starting with http:// or https://' },
      { status: 400 },
    );
  }

  const [newCredential] = await db
    .insert(apiCredentials)
    .values({
      apiUrl,
      oauthUrl: oauthUrl || null,
      username: username || null,
      passwordEncrypted: password ? encryptValue(password) : null,
    })
    .returning();

  return NextResponse.json({ credential: sanitizeCredential(newCredential) }, { status: 201 });
}
