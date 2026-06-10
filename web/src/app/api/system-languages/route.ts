import { NextResponse } from 'next/server';
import { db, systemLanguages } from '@/db';

export async function GET() {
  const languages = await db
    .select()
    .from(systemLanguages)
    .orderBy(systemLanguages.code);
  return NextResponse.json({ languages });
}
