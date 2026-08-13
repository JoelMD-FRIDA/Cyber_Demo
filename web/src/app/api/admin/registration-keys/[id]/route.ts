import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';
import type { Database } from '@/lib/supabase/types';

function mapKey(key: Record<string, unknown>) {
  return { id: key.id, code: key.code, company: key.company, companyDomain: key.company_domain, totalSlots: key.total_slots, usedCount: key.used_count, enabled: key.enabled, expiresAt: key.expires_at, createdAt: key.created_at };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const { data, error } = await admin.from('registration_keys').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError('NOT_FOUND', 'Registration key not found.', 404);
    return NextResponse.json({ key: mapKey(data as unknown as Record<string, unknown>) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const values: Database['public']['Tables']['registration_keys']['Update'] = {};
    if (body.code !== undefined) values.code = String(body.code).trim();
    if (body.company !== undefined) values.company = body.company || null;
    if (body.companyDomain !== undefined) values.company_domain = body.companyDomain || null;
    if (body.totalSlots !== undefined) {
      const slots = Number(body.totalSlots);
      if (!Number.isInteger(slots) || slots < 1) throw new ApiError('INVALID_INPUT', 'Slot count must be positive.');
      values.total_slots = slots;
    }
    if (body.enabled !== undefined) values.enabled = Boolean(body.enabled);
    if (body.expiresAt !== undefined) values.expires_at = body.expiresAt || null;
    const { data, error } = await admin.from('registration_keys').update(values).eq('id', id).select('*').maybeSingle();
    if (error) throw new ApiError(error.code === '23505' ? 'CONFLICT' : 'INTERNAL_ERROR', error.message, error.code === '23505' ? 409 : 500);
    if (!data) throw new ApiError('NOT_FOUND', 'Registration key not found.', 404);
    return NextResponse.json({ key: mapKey(data as unknown as Record<string, unknown>) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const { error } = await admin.from('registration_keys').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: 'Registration key deleted.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
