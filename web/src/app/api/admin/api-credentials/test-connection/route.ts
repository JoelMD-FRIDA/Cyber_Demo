import { NextRequest, NextResponse } from 'next/server';
import { db, apiCredentials } from '@/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/session';
import { Role } from '@/lib/rbac';
import { decryptValue } from '@/lib/crypto';

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

export async function POST(request: NextRequest) {
  const adminCheck = await requireAdmin(request);
  if (adminCheck.error) return adminCheck.error;

  const body = await request.json();
  const { id } = body;

  if (!id) {
    return NextResponse.json(
      { error: 'Credential ID is required' },
      { status: 400 },
    );
  }

  const [credential] = await db
    .select()
    .from(apiCredentials)
    .where(eq(apiCredentials.id, id))
    .limit(1);

  if (!credential) {
    return NextResponse.json(
      { error: 'API credential not found' },
      { status: 404 },
    );
  }

  let decryptedPassword: string | null = null;
  try {
    if (credential.passwordEncrypted) {
      decryptedPassword = decryptValue(credential.passwordEncrypted);
    }
  } catch {
    return NextResponse.json(
      { error: 'Failed to decrypt stored password. The encryption key may have changed.' },
      { status: 500 },
    );
  }

  const isFixtureMode = process.env.TEST_CONNECTION_FIXTURE === 'true' || !process.env.CYSMO_API_BASE_URL;

  if (isFixtureMode) {
    // Fixture mode: validate credential format only, no real connection
    const issues: string[] = [];
    if (!credential.apiUrl) {
      issues.push('Missing API URL');
    }
    if (!credential.apiUrl?.startsWith('http')) {
      issues.push('API URL must start with http:// or https://');
    }
    if (!credential.username && !decryptedPassword) {
      issues.push('Neither username nor password configured');
    }
    if (decryptedPassword !== null && decryptedPassword.length < 4) {
      issues.push('Password seems too short');
    }

    if (issues.length > 0) {
      return NextResponse.json({
        success: false,
        message: `Fixture validation failed: ${issues.join('; ')}`,
        fixtureMode: true,
        issues,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Fixture validation passed. Credential format is valid.',
      fixtureMode: true,
      details: {
        apiUrl: credential.apiUrl,
        hasUsername: !!credential.username,
        hasPassword: !!decryptedPassword,
        passwordLength: decryptedPassword?.length ?? 0,
      },
    });
  }

  // Real connection test mode (requires CYSMO_API_BASE_URL)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(credential.apiUrl, {
      method: 'HEAD',
      headers: decryptedPassword
        ? { Authorization: `Bearer ${decryptedPassword}` }
        : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return NextResponse.json({
      success: response.ok,
      message: response.ok
        ? `Connection successful (HTTP ${response.status})`
        : `Connection returned HTTP ${response.status}`,
      fixtureMode: false,
      statusCode: response.status,
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : 'Unknown connection error';
    return NextResponse.json({
      success: false,
      message: `Connection failed: ${message}`,
      fixtureMode: false,
    });
  }
}