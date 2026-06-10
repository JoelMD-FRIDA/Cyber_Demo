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

export async function GET(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const accounts = await db
    .select()
    .from(emailAccounts)
    .orderBy(emailAccounts.createdAt);

  const result = await Promise.all(
    accounts.map(async (account) => {
      const outgoingConfigs = await db
        .select()
        .from(outgoingEmailConfigs)
        .where(eq(outgoingEmailConfigs.emailAccountId, account.id))
        .limit(1);
      return {
        ...account,
        outgoingConfig: outgoingConfigs[0] ?? null,
      };
    }),
  );

  return NextResponse.json({ emailAccounts: result });
}

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const body = await request.json();
  const {
    mailAddress,
    username,
    password,
    fromDisplayName,
    serverHost,
    serverPort,
    outgoingProtocol,
    ssl,
    tls,
  } = body;

  if (!mailAddress || !username || !password) {
    return NextResponse.json(
      { error: 'mailAddress, username, and password are required' },
      { status: 400 },
    );
  }

  const [account] = await db
    .insert(emailAccounts)
    .values({
      mailAddress,
      username,
      passwordEncrypted: encryptValue(password),
      fromDisplayName: fromDisplayName || mailAddress,
      isOutgoingEmailConfigured: !!(serverHost && outgoingProtocol !== undefined),
    })
    .returning();

  if (serverHost && outgoingProtocol !== undefined) {
    await db.insert(outgoingEmailConfigs).values({
      emailAccountId: account.id,
      serverHost,
      serverPort: serverPort ?? 587,
      outgoingProtocol,
      ssl: ssl ?? false,
      tls: tls ?? false,
    });
  }

  const outgoingConfigs = await db
    .select()
    .from(outgoingEmailConfigs)
    .where(eq(outgoingEmailConfigs.emailAccountId, account.id))
    .limit(1);

  return NextResponse.json(
    {
      emailAccount: {
        ...account,
        outgoingConfig: outgoingConfigs[0] ?? null,
      },
    },
    { status: 201 },
  );
}
