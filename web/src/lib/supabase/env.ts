// Explicit references let Next safely inline the current public browser config.
// These legacy Supabase consumers will be removed during the PostgreSQL migration.
function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} is not configured.`);
  return value.trim();
}

export function getSupabaseUrl(): string {
  return required(process.env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
}

export function getSupabaseAnonKey(): string {
  return required(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

export function getSupabaseServiceRoleKey(): string {
  return required(process.env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
}
