import { supabaseAdmin } from "@/lib/supabase";
import { type RecognitionOptions } from "@/lib/slack-recognition-view";

const MAX_OPTIONS = 100;

// Options are read from the same tables the web form uses, so the modal can only
// offer active values and live campaigns.
export async function loadRecognitionOptions(): Promise<RecognitionOptions> {
  const [values, campaigns] = await Promise.all([
    supabaseAdmin
      .from("recognition_values")
      .select("id,name")
      .eq("is_active", true)
      .limit(MAX_OPTIONS),
    supabaseAdmin
      .from("recognition_campaigns")
      .select("id,name")
      .eq("status", "live")
      .limit(MAX_OPTIONS),
  ]);
  return {
    values: (values.data ?? []) as { id: string; name: string }[],
    campaigns: (campaigns.data ?? []) as { id: string; name: string }[],
  };
}
