import { cookies, headers } from 'next/headers';
import { createDatabaseClient, type AppDatabaseClient } from '@/lib/db/client';
import type { Database } from '@/lib/db/types';
import { ApiError } from '@/lib/api-errors';
import { SESSION_COOKIE, sessionForCookie } from './session';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export interface AuthenticatedRequestContext {
  user: { id: string; email: string };
  profile: Profile;
  db: AppDatabaseClient;
}
export async function getAuthenticatedContext(): Promise<AuthenticatedRequestContext | null> {
  if ((await headers()).has('authorization')) return null;
  const session = await sessionForCookie((await cookies()).get(SESSION_COOKIE)?.value);
  return session ? { user: session.user, profile: session.profile, db: createDatabaseClient() } : null;
}
export async function requireUser(): Promise<AuthenticatedRequestContext> {
  const context = await getAuthenticatedContext();
  if (!context) throw new ApiError('UNAUTHORIZED','Authentication is required.',401);
  return context;
}
export async function requireAdmin() {
  const context = await requireUser();
  if (context.profile.role !== 'admin') throw new ApiError('FORBIDDEN','Administrator access is required.',403);
  return { ...context, admin: createDatabaseClient() };
}
export function mapProfile(profile: Profile, user?: { email?: string }) {
  return { id: profile.id, email: user?.email ?? profile.email, username: profile.username,
    firstname: profile.firstname, lastname: profile.lastname, company: profile.company,
    role: profile.role, enabled: profile.enabled, performedDomainChecks: profile.performed_domain_checks,
    createdAt: profile.created_at, updatedAt: profile.updated_at };
}
