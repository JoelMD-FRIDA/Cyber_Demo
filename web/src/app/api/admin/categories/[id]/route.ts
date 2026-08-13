import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';
import { mapCategory } from '@/server/catalog';
import type { Database } from '@/lib/supabase/types';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const { data, error } = await admin.from('domain_check_categories').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError('NOT_FOUND', 'Category not found.', 404);
    return NextResponse.json({ category: mapCategory(data) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const values: Database['public']['Tables']['domain_check_categories']['Update'] = {};
    if (body.categoryKey !== undefined) values.category_key = String(body.categoryKey).trim().toLowerCase();
    if (body.name !== undefined) values.name = String(body.name).trim();
    if (body.description !== undefined) values.description = body.description || null;
    const { data, error } = await admin.from('domain_check_categories').update(values).eq('id', id).select('*').maybeSingle();
    if (error) throw new ApiError(error.code === '23505' ? 'CONFLICT' : 'INTERNAL_ERROR', error.message, error.code === '23505' ? 409 : 500);
    if (!data) throw new ApiError('NOT_FOUND', 'Category not found.', 404);
    return NextResponse.json({ category: mapCategory(data) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const { error } = await admin.from('domain_check_categories').delete().eq('id', id);
    if (error) {
      if (error.code === '23503') throw new ApiError('CONFLICT', 'Category is used by an existing check.', 409);
      throw new Error(error.message);
    }
    return NextResponse.json({ message: 'Category deleted.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
