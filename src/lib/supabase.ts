import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Browser-safe client (anon key, RLS applies — but our policies block anon entirely)
export const supabase = createClient<Database>(url, anon);

// Server-only client (service role, bypasses RLS — use only in API routes / server actions)
export const supabaseAdmin = createClient<Database>(url, service, {
  auth: { persistSession: false },
});
