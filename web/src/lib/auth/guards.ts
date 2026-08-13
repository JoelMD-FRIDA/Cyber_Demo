import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/types';
import { ApiError } from '@/lib/api-errors';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type AppSupabaseClient = SupabaseClient<Database>;

export interface AuthenticatedRequestContext {
  user: User;
  profile: Profile;
  supabase: AppSupabaseClient;
}

export async function getAuthenticatedContext(): Promise<AuthenticatedRequestContext | null> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error || !profile) return null;
  return { user, profile, supabase };
}

export async function requireUser(): Promise<AuthenticatedRequestContext> {
  const context = await getAuthenticatedContext();
  if (!context) throw new ApiError('UNAUTHORIZED', 'Authentication is required.', 401);
  return context;
}

export async function requireAdmin(): Promise<AuthenticatedRequestContext & { admin: AppSupabaseClient }> {
  const context = await requireUser();
  if (context.profile.role !== 'admin') {
    throw new ApiError('FORBIDDEN', 'Administrator access is required.', 403);
  }
  return { ...context, admin: createSupabaseAdminClient() };
}

export function mapProfile(profile: Profile, user?: User) {
  return {
    id: profile.id,
    email: user?.email ?? profile.email,
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
