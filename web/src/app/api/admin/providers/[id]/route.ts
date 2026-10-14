import { jsonBody,optionalText } from '@/lib/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';
import { mapProvider, validateOptionalUrl } from '@/server/catalog';
import type { Database } from '@/lib/db/types';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const { data, error } = await admin.from('domain_check_providers').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError('NOT_FOUND', 'Provider not found.', 404);
    return NextResponse.json({ provider: mapProvider(data) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const body = await jsonBody(request);
    const values: Database['public']['Tables']['domain_check_providers']['Update'] = {};
    if (body.providerKey !== undefined) values.provider_key = String(body.providerKey).trim().toLowerCase();
    if (body.name !== undefined) values.name = String(body.name).trim();
    if (body.isActive !== undefined) values.is_active = Boolean(body.isActive);
    if (body.websiteUrl !== undefined) values.website_url = validateOptionalUrl(body.websiteUrl);
    if (body.description !== undefined) values.description = optionalText(body.description);
    if (body.shortDescription !== undefined) values.short_description = optionalText(body.shortDescription);
    if (body.longDescription !== undefined) values.long_description = optionalText(body.longDescription);
    const { data, error } = await admin.from('domain_check_providers').update(values).eq('id', id).select('*').maybeSingle();
    if (error) throw new ApiError(error.code === '23505' ? 'CONFLICT' : 'INTERNAL_ERROR', error.message, error.code === '23505' ? 409 : 500);
    if (!data) throw new ApiError('NOT_FOUND', 'Provider not found.', 404);
    return NextResponse.json({ provider: mapProvider(data) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const { error } = await admin.from('domain_check_providers').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') throw new ApiError('CONFLICT', 'Provider is used by an existing check.', 409);
      throw new Error(error.message);
    }
    return NextResponse.json({ message: 'Provider deleted.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
