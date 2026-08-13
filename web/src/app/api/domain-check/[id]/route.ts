import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { getDomainCheck } from '@/server/domain-check-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    return NextResponse.json({ check: await getDomainCheck(id) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
