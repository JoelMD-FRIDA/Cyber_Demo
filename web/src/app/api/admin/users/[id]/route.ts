import { jsonBody,optionalText } from '@/lib/request-body';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guards';
import { apiErrorResponse, ApiError } from '@/lib/api-errors';
import type { Database } from '@/lib/db/types';

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
    const body = await jsonBody(request);
    const values: Database['public']['Tables']['profiles']['Update'] = {};
    if (body.username !== undefined) values.username = typeof body.username === 'string' && body.username.trim() ? body.username.trim().toLowerCase() : null;
    if (body.firstname !== undefined) values.firstname = optionalText(body.firstname);
    if (body.lastname !== undefined) values.lastname = optionalText(body.lastname);
    if (body.company !== undefined) values.company = optionalText(body.company);
    if (body.role !== undefined) {
      if (typeof body.role!=='string' || !['admin', 'user'].includes(body.role)) throw new ApiError('INVALID_INPUT', 'Role must be admin or user.');
      values.role = body.role as 'admin'|'user';
    }

    if (body.email !== undefined || body.password !== undefined) throw new ApiError('INVALID_INPUT','Identity credentials are managed centrally.');

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
    const { error } = await admin.from('profiles').update({ enabled:false }).eq('id',id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ message: 'Sandbox access disabled.' });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
