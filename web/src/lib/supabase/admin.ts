import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from './env';

let client: SupabaseClient<Database> | undefined;

export function createSupabaseAdminClient(): SupabaseClient<Database> {
  if (!client) {
    client = createClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}
