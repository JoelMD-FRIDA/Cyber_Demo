import { jsonBody } from '@/lib/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { createQueuedDomainCheck } from '@/server/domain-check-service';

export async function POST(request: NextRequest) {
  try {
    const body = await jsonBody(request);
    const check = await createQueuedDomainCheck({
      url: typeof body.url === 'string' ? body.url : '',
      providerId: typeof body.providerId === 'string' ? body.providerId : undefined,
      categoryId: typeof body.categoryId === 'string' ? body.categoryId : undefined,
      hasAcceptedDisclaimer: body.hasAcceptedDisclaimer === true,
      disclaimerVersion: typeof body.disclaimerVersion === 'string' ? body.disclaimerVersion : undefined,
    });
    return NextResponse.json({ check }, { status: 202 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
