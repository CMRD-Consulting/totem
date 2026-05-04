import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function supabaseAdmin(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function supabaseAsUser(jwt: string): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false },
  });
}
