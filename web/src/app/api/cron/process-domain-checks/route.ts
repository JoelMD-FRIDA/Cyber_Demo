import { NextRequest, NextResponse } from 'next/server';
import { processDomainCheckQueue } from '@/server/domain-check-service';

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? request.headers.get('x-api-key');
  if (!secret || supplied !== secret) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  try {
    return NextResponse.json(await processDomainCheckQueue());
  } catch (error) {
    console.error('Domain check worker failed:', error);
    return NextResponse.json({ error: 'Worker failed', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
