import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, string> = {};

  // 1. Check env vars
  results.JWT_SECRET = process.env.JWT_SECRET ? `✅ set (${process.env.JWT_SECRET.slice(0, 8)}...)` : '❌ MISSING';
  results.DATABASE_URL = process.env.DATABASE_URL ? `✅ set` : '❌ MISSING';
  results.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ? `✅ set` : '❌ MISSING';

  // 2. Test DB connection
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    const result = await pool.query('SELECT 1 AS ok');
    await pool.end();
    results.db_connection = `✅ ok (${result.rows[0].ok})`;
  } catch (e: any) {
    results.db_connection = `❌ ${e.message}`;
  }

  // 3. Test bcrypt
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('test', 10);
    const match = bcrypt.compareSync('test', hash);
    results.bcrypt = match ? '✅ works' : '❌ mismatch';
  } catch (e: any) {
    results.bcrypt = `❌ ${e.message}`;
  }

  // 4. Test JWT signing
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET not set');
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ test: true }, secret, { expiresIn: '1h' });
    const decoded = jwt.verify(token, secret);
    results.jwt = decoded.test ? '✅ works' : '❌ decode failed';
  } catch (e: any) {
    results.jwt = `❌ ${e.message}`;
  }

  return NextResponse.json(results);
}
