import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';

function mapKey(key: Record<string, unknown>) {
  return { id: key.id, code: key.code, company: key.company, companyDomain: key.company_domain, totalSlots: key.total_slots, usedCount: key.used_count, enabled: key.enabled, expiresAt: key.expires_at, createdAt: key.created_at };
}

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin();
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '10', 10)));
    const search = request.nextUrl.searchParams.get('search')?.trim();
    const from = (page - 1) * limit;
    let query = admin.from('registration_keys').select('*', { count: 'exact' }).order('created_at').range(from, from + limit - 1);
    if (search) query = query.ilike('code', `%${search}%`);
    const { data, count, error } = await query;
    if (error) throw new Error(error.message);
    const total = count ?? 0;
    return NextResponse.json({ keys: (data ?? []).map((key) => mapKey(key as unknown as Record<string, unknown>)), total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin();
    const body = await request.json();
    const code = typeof body.code === 'string' ? body.code.trim() : '';
    const totalSlots = Number(body.totalSlots);
    if (!code || !Number.isInteger(totalSlots) || totalSlots < 1) throw new ApiError('INVALID_INPUT', 'Code and a positive slot count are required.');
    const { data, error } = await admin.from('registration_keys').insert({
      code,
      company: body.company || null,
      company_domain: body.companyDomain || null,
      total_slots: totalSlots,
      enabled: body.enabled !== false,
      expires_at: body.expiresAt || null,
    }).select('*').single();
    if (error) throw new ApiError(error.code === '23505' ? 'CONFLICT' : 'INTERNAL_ERROR', error.message, error.code === '23505' ? 409 : 500);
    return NextResponse.json({ key: mapKey(data as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
