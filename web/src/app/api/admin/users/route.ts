import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';

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

export async function POST(request: NextRequest) {
  try {
    const { admin } = await requireAdmin();
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!email || !password) throw new ApiError('INVALID_INPUT', 'Email and password are required.');
    if (!['admin', 'user'].includes(body.role ?? 'user')) throw new ApiError('INVALID_INPUT', 'Role must be admin or user.');

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        firstname: body.firstname || null,
        lastname: body.lastname || null,
        username: typeof body.username === 'string' && body.username.trim() ? body.username.trim().toLowerCase() : null,
        company: body.company || null,
      },
    });
    if (createError || !created.user) throw new ApiError(createError?.code === 'email_exists' ? 'CONFLICT' : 'INVALID_INPUT', createError?.message ?? 'Unable to create the user.', createError?.code === 'email_exists' ? 409 : 400);

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .update({ role: body.role ?? 'user' })
      .eq('id', created.user.id)
      .select('*')
      .single();
    if (profileError || !profile) throw new Error(profileError?.message ?? 'Unable to create the user profile.');
    return NextResponse.json({ user: mapUser(profile as unknown as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
