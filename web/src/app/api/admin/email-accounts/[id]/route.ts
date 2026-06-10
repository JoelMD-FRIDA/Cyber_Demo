import { NextRequest, NextResponse } from 'next/server';
import { db, emailAccounts, outgoingEmailConfigs } from '@/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';
import { encryptValue } from '@/lib/crypto';

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

async function getAccountWithConfig(id: string) {
  const account = await db
    .select()
    .from(emailAccounts)
    .where(eq(emailAccounts.id, id))
    .limit(1);
  if (account.length === 0) return null;
  const outgoing = await db
    .select()
    .from(outgoingEmailConfigs)
    .where(eq(outgoingEmailConfigs.emailAccountId, id))
    .limit(1);
  return { ...account[0], outgoingConfig: outgoing[0] ?? null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const account = await getAccountWithConfig(id);
  if (!account) {
    return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
  }
  return NextResponse.json({ emailAccount: account });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const existing = await getAccountWithConfig(id);
  if (!existing) {
    return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
  }

  const body = await request.json();
  const accountUpdate: Record<string, unknown> = {};

  if ('mailAddress' in body) accountUpdate.mailAddress = body.mailAddress;
  if ('username' in body) accountUpdate.username = body.username;
  if ('password' in body && body.password) {
    accountUpdate.passwordEncrypted = encryptValue(body.password);
  }
  if ('fromDisplayName' in body) accountUpdate.fromDisplayName = body.fromDisplayName;

  if (Object.keys(accountUpdate).length > 0) {
    await db
      .update(emailAccounts)
      .set(accountUpdate)
      .where(eq(emailAccounts.id, id));
  }

  if ('serverHost' in body || 'serverPort' in body || 'outgoingProtocol' in body || 'ssl' in body || 'tls' in body) {
    const outgoingData: Record<string, unknown> = {};
    if ('serverHost' in body) outgoingData.serverHost = body.serverHost;
    if ('serverPort' in body) outgoingData.serverPort = body.serverPort;
    if ('outgoingProtocol' in body) outgoingData.outgoingProtocol = body.outgoingProtocol;
    if ('ssl' in body) outgoingData.ssl = body.ssl;
    if ('tls' in body) outgoingData.tls = body.tls;

    if (existing.outgoingConfig) {
      await db
        .update(outgoingEmailConfigs)
        .set(outgoingData)
        .where(eq(outgoingEmailConfigs.emailAccountId, id));
    } else if (outgoingData.serverHost && outgoingData.outgoingProtocol !== undefined) {
      await db
        .insert(outgoingEmailConfigs)
        .values({ emailAccountId: id, ...outgoingData } as typeof outgoingEmailConfigs.$inferInsert);
    }
  }

  const updated = await getAccountWithConfig(id);
  return NextResponse.json({ emailAccount: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const { id } = await params;
  const existing = await getAccountWithConfig(id);
  if (!existing) {
    return NextResponse.json({ error: 'Email account not found' }, { status: 404 });
  }

  await db.delete(emailAccounts).where(eq(emailAccounts.id, id));
  return NextResponse.json({ message: 'Email account deleted' });
}
