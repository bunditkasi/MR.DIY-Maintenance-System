import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return cachedClient;
}

export async function ensureSupabaseSession(client: SupabaseClient): Promise<void> {
  const current = await client.auth.getSession();
  if (current.data.session) {
    return;
  }

  const created = await client.auth.signInAnonymously();
  if (created.error) {
    throw new Error(created.error.message);
  }
}
