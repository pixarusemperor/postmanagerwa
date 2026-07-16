import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export function createServerSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false },
    }
  );
}

export function createBrowserSupabaseClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

let _adminClient: ReturnType<typeof createClient<Database>> | null = null;
export function getSupabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createServerSupabaseClient();
  }
  return _adminClient;
}
