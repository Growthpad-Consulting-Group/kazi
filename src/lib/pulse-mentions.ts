import { createHash } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { deliverSlackNotification } from "@/lib/slack";

function hasMention(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)@${escaped}(?=$|[\\s,.;:!?])`, "i").test(text);
}

/**
 * Records only authorised @mentions. The notification never contains the
 * source text, preventing an alert from becoming a side channel for notes.
 */
export async function notifyPulseMentions({
  sourceType,
  sourceId,
  text,
  actorId,
  allowedRecipientIds,
  link,
}: {
  sourceType: string;
  sourceId: string;
  text: string;
  actorId: string;
  allowedRecipientIds: string[];
  link: string;
}) {
  const clean = text.trim();
  const recipientIds = [...new Set(allowedRecipientIds)].filter(
    (id) => id !== actorId,
  );
  if (!clean || !recipientIds.length) return;
  const { data: people } = await supabaseAdmin
    .from("users")
    .select("id,name")
    .in("id", recipientIds)
    .eq("is_active", true);
  const mentioned = (people ?? []).filter((person) =>
    hasMention(clean, person.name),
  );
  if (!mentioned.length) return;

  const bodyHash = createHash("sha256").update(clean).digest("hex");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table awaits generated types
  const { data } = await (supabaseAdmin as any)
    .from("pulse_mentions")
    .upsert(
      mentioned.map((person) => ({
        source_type: sourceType,
        source_id: sourceId,
        recipient_user_id: person.id,
        mentioned_by: actorId,
        body_hash: bodyHash,
      })),
      {
        onConflict: "source_type,source_id,recipient_user_id,body_hash",
        ignoreDuplicates: true,
      },
    )
    .select("recipient_user_id");
  const createdRecipientIds: string[] = (data ?? []).map(
    (row: { recipient_user_id: string }) => row.recipient_user_id,
  );
  if (!createdRecipientIds.length) return;
  await Promise.all([
    supabaseAdmin.from("notifications").insert(
      createdRecipientIds.map((userId) => ({
        user_id: userId,
        message: "You were mentioned in shared 1-on-1 notes.",
        link,
      })),
    ),
    ...createdRecipientIds.map((recipientUserId) =>
      deliverSlackNotification({
        eventKey: `pulse-mention:${sourceType}:${sourceId}:${bodyHash}:${recipientUserId}`,
        recipientUserId,
        category: "mention",
        text: "You were mentioned in shared 1-on-1 notes.",
      }),
    ),
  ]);
}
