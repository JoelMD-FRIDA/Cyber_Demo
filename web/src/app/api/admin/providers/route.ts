import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';
import { mapProvider, validateOptionalUrl } from '@/server/catalog';

export async function GET() {
  try {
    const { admin } = await requireAdmin();
    const { data, error } = await admin.from('domain_check_providers').select('*').order('name');
    if (error) throw new Error(error.message);
    return NextResponse.json({ providers: (data ?? []).map(mapProvider) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin();
    const body = await request.json();
    const providerKey = typeof body.providerKey === 'string' ? body.providerKey.trim().toLowerCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!providerKey || !name) throw new ApiError('INVALID_INPUT', 'Provider key and name are required.');
    const { data, error } = await admin.from('domain_check_providers').insert({
      provider_key: providerKey,
      name,
      is_active: body.isActive !== false,
      website_url: validateOptionalUrl(body.websiteUrl),
      description: body.description || null,
      short_description: body.shortDescription || null,
      long_description: body.longDescription || null,
    }).select('*').single();
    if (error) throw new ApiError(error.code === '23505' ? 'CONFLICT' : 'INTERNAL_ERROR', error.message, error.code === '23505' ? 409 : 500);
    return NextResponse.json({ provider: mapProvider(data) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
