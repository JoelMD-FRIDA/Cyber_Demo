import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { getDomainCheckOptions } from '@/server/domain-check-service';

export async function GET() {
  try {
    return NextResponse.json(await getDomainCheckOptions());
  } catch (error) {
    return apiErrorResponse(error);
  }
}
