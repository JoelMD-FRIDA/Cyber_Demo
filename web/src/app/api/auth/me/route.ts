import { NextResponse } from 'next/server';
import { apiErrorResponse } from '@/lib/api-errors';
import { getAuthenticatedContext, mapProfile } from '@/lib/auth/guards';

export async function GET() {
  try {
    const context = await getAuthenticatedContext();
    if (!context) return NextResponse.json({ error: 'Authentication is required.', code: 'UNAUTHORIZED' }, { status: 401 });
    return NextResponse.json(mapProfile(context.profile, context.user));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
