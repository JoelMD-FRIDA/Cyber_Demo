export const hasSupabaseE2EConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const hasUserE2EConfig = Boolean(
  hasSupabaseE2EConfig && process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD,
);

export const hasAdminE2EConfig = Boolean(
  hasSupabaseE2EConfig && process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD,
);
