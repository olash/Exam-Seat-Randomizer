import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase client, initialised lazily.
 * Throws a clear error if env vars are not configured.
 */
export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !url ||
    !key ||
    url === "your_supabase_project_url_here" ||
    key === "your_supabase_anon_key_here"
  ) {
    throw new Error(
      "Supabase is not configured. " +
        "Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }

  _client = createClient(url, key);
  return _client;
}

/** Convenience re-export — only use in client components where Supabase is genuinely needed */
export const supabase = {
  get client() {
    return getSupabaseClient();
  },
};
