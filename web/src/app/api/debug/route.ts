import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { dbPool } from '@/db';
import { envStatus, requireJwtSecret } from '@/lib/runtime-env';

function hasTestClaim(payload: string | JwtPayload): boolean {
  return typeof payload !== 'string' && payload.test === true;
}

export async function GET() {
  const results: Record<string, string> = {};

  // 1. Check env vars
  results.JWT_SECRET = envStatus('JWT_SECRET') === 'set' ? '✅ set' : '❌ MISSING';
  results.DATABASE_URL = envStatus('DATABASE_URL') === 'set' ? '✅ set' : '❌ MISSING';
  results.NEXT_PUBLIC_BASE_URL = envStatus('NEXT_PUBLIC_BASE_URL') === 'set' ? '✅ set' : '❌ MISSING';

  // 2. Test DB connection
  try {
    const result = await dbPool.query<{ ok: number }>('SELECT 1 AS ok');
    results.db_connection = `✅ ok (${result.rows[0].ok})`;
  } catch (error) {
    results.db_connection = `❌ ${error instanceof Error ? error.message : String(error)}`;
  }

  // 3. Test bcrypt
  try {
    const hash = bcrypt.hashSync('test', 10);
    const match = bcrypt.compareSync('test', hash);
    results.bcrypt = match ? '✅ works' : '❌ mismatch';
  } catch (error) {
    results.bcrypt = `❌ ${error instanceof Error ? error.message : String(error)}`;
  }

  // 4. Test JWT signing
  try {
    const secret = requireJwtSecret();
    const token = jwt.sign({ test: true }, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret);
    results.jwt = hasTestClaim(decoded) ? '✅ works' : '❌ decode failed';
  } catch (error) {
    results.jwt = `❌ ${error instanceof Error ? error.message : String(error)}`;
  }

  return NextResponse.json(results);
}
