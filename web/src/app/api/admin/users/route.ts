import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse } from '@/lib/api-errors';

function mapUser(profile: Record<string, unknown>) {
  return {
    id: profile.id,
    email: profile.email,
    username: profile.username,
    firstname: profile.firstname,
    lastname: profile.lastname,
    company: profile.company,
    role: profile.role,
    performedDomainChecks: profile.performed_domain_checks,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { admin } = await requireAdmin();
    const page = Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '10', 10)));
    const search = request.nextUrl.searchParams.get('search')?.trim();
    const from = (page - 1) * limit;
    let query = admin.from('profiles').select('*', { count: 'exact' }).order('created_at').range(from, from + limit - 1);
    if (search) query = query.ilike('email', `%${search}%`);
    const { data, count, error } = await query;
    if (error) throw new Error(error.message);
    const total = count ?? 0;
    return NextResponse.json({ users: (data ?? []).map((user) => mapUser(user as unknown as Record<string, unknown>)), total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST() { return NextResponse.json({ error:'Accounts are created through central sign-in.' },{ status:410 }); }
