import { NextRequest, NextResponse } from 'next/server';
import { db, apiCredentials } from '@/db';
import { eq } from 'drizzle-orm';
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

async function findCredential(id: string) {
  const result = await db
    .select()
    .from(apiCredentials)
    .where(eq(apiCredentials.id, id))
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
  const credential = await findCredential(id);

  if (!credential) {
    return NextResponse.json({ error: 'API credential not found' }, { status: 404 });
  }

  return NextResponse.json({ credential: sanitizeCredential(credential) });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const credential = await findCredential(id);

  if (!credential) {
    return NextResponse.json({ error: 'API credential not found' }, { status: 404 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  if ('apiUrl' in body) {
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(body.apiUrl)) {
      return NextResponse.json(
        { error: 'apiUrl must be a valid URL starting with http:// or https://' },
        { status: 400 },
      );
    }
    updateData.apiUrl = body.apiUrl;
  }
  if ('oauthUrl' in body) {
    if (body.oauthUrl && !/^https?:\/\/.+/.test(body.oauthUrl)) {
      return NextResponse.json(
        { error: 'oauthUrl must be a valid URL starting with http:// or https://' },
        { status: 400 },
      );
    }
    updateData.oauthUrl = body.oauthUrl || null;
  }
  if ('username' in body) {
    updateData.username = body.username || null;
  }
  if ('password' in body) {
    updateData.passwordEncrypted = body.password ? encryptValue(body.password) : null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ credential: sanitizeCredential(credential) });
  }

  const [updatedCredential] = await db
    .update(apiCredentials)
    .set(updateData)
    .where(eq(apiCredentials.id, id))
    .returning();

  return NextResponse.json({ credential: sanitizeCredential(updatedCredential) });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const credential = await findCredential(id);

  if (!credential) {
    return NextResponse.json({ error: 'API credential not found' }, { status: 404 });
  }

  await db
    .delete(apiCredentials)
    .where(eq(apiCredentials.id, id));

  return NextResponse.json({ message: 'API credential deleted' });
}
