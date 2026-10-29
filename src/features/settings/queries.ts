import { supabaseAdmin } from "@/lib/supabase";

/** Fetch AI provider config from DB, falling back to env vars. */
export async function getAISettings() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("system_settings")
    .select("ai_provider, ai_model, ai_api_key")
    .eq("key", "ai")
    .maybeSingle();

  type Row = {
    ai_provider?: string;
    ai_model?: string;
    ai_api_key?: string;
  } | null;
  const row = data as Row;
  return {
    provider: row?.ai_provider ?? process.env.AI_PROVIDER ?? "groq",
    model: row?.ai_model ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
    apiKeySet: Boolean(row?.ai_api_key ?? process.env.GROQ_API_KEY),
  };
}
