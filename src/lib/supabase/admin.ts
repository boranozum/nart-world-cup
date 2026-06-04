import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS — SERVER ONLY.
 * Use for admin/privileged operations (e.g. storage uploads on the user's behalf,
 * match conclusion/finalization). Never import this into client code.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
