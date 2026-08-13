import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';
import type { Database } from '@/lib/supabase/types';

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

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const { data, error } = await admin.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError('NOT_FOUND', 'User not found.', 404);
    return NextResponse.json({ user: mapUser(data as unknown as Record<string, unknown>) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin } = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const values: Database['public']['Tables']['profiles']['Update'] = {};
    if (body.username !== undefined) values.username = typeof body.username === 'string' && body.username.trim() ? body.username.trim().toLowerCase() : null;
    if (body.firstname !== undefined) values.firstname = body.firstname || null;
    if (body.lastname !== undefined) values.lastname = body.lastname || null;
    if (body.company !== undefined) values.company = body.company || null;
    if (body.role !== undefined) {
      if (!['admin', 'user'].includes(body.role)) throw new ApiError('INVALID_INPUT', 'Role must be admin or user.');
      values.role = body.role;
    }

    if (body.email !== undefined || body.password) {
      const { error } = await admin.auth.admin.updateUserById(id, {
        ...(body.email ? { email: String(body.email).trim().toLowerCase() } : {}),
        ...(body.password ? { password: body.password } : {}),
      });
      if (error) throw new ApiError(error.code === 'email_exists' ? 'CONFLICT' : 'INVALID_INPUT', error.message, error.code === 'email_exists' ? 409 : 400);
    }

    const { data, error } = await admin.from('profiles').update(values).eq('id', id).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new ApiError('NOT_FOUND', 'User not found.', 404);
    return NextResponse.json({ user: mapUser(data as unknown as Record<string, unknown>) });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { admin, user } = await requireAdmin();
    const { id } = await params;
    if (id === user.id) throw new ApiError('INVALID_INPUT', 'You cannot delete your own account.', 400);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: 'User deleted.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
