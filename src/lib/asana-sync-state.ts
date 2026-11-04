import { supabaseAdmin } from "@/lib/supabase";

/**
 * Records the outcome of the last Asana read for a person, so Settings can show
 * whether their sync works. Stores a short error message only, never task data.
 */
export async function recordAsanaSync(userId: string, error: string | null) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed columns
    await (supabaseAdmin as any)
      .from("asana_connections")
      .update(
        error
          ? { last_sync_error: error.slice(0, 200) }
          : { last_synced_at: new Date().toISOString(), last_sync_error: null },
      )
      .eq("user_id", userId);
  } catch (writeError) {
    console.error("[asana-sync] could not record sync state", writeError);
  }
}
