import { supabaseAdmin } from "@/lib/supabase";

type AiAuditEntry = {
  operation: string;
  entityType: string;
  entityId: string;
  model: string;
  inputCharacters: number;
  outputCharacters: number;
  tokensUsed: number | null | undefined;
};

/**
 * Retain operational evidence without persisting CVs, candidate details, or
 * generated correspondence a second time in the audit table.
 */
export async function recordAiUsage(entry: AiAuditEntry) {
  await supabaseAdmin.from("ai_logs").insert({
    operation: entry.operation,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    model: entry.model,
    prompt: JSON.stringify({ redacted: true, input_characters: entry.inputCharacters }),
    response: JSON.stringify({ redacted: true, output_characters: entry.outputCharacters }),
    tokens_used: entry.tokensUsed ?? null,
  });
}
