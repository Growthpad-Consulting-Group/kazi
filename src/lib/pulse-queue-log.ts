import { supabaseAdmin } from "@/lib/supabase";
import { diffQueue, type QueueScope } from "@/features/pulse/measurement";

// Migration-backed tables outside the generated types are read through `any`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
const db = supabaseAdmin as any;

/**
 * Records when a queue item appears and when it clears, so usefulness can be
 * measured. Only the item kind and timestamps are stored. It never throws:
 * measurement must not break the page it describes.
 */
export async function recordQueueLifecycle({
  userId,
  scope,
  kinds,
  now = new Date(),
}: {
  userId: string;
  scope: QueueScope;
  kinds: string[];
  now?: Date;
}): Promise<void> {
  try {
    const { data } = await db
      .from("pulse_queue_items")
      .select("kind")
      .eq("user_id", userId)
      .eq("scope", scope)
      .is("resolved_at", null);
    const openKinds = ((data ?? []) as { kind: string }[]).map(
      (row) => row.kind,
    );
    const { opened, resolved } = diffQueue(openKinds, kinds);

    if (opened.length)
      await db.from("pulse_queue_items").insert(
        opened.map((kind) => ({
          user_id: userId,
          scope,
          kind,
          first_seen_at: now.toISOString(),
        })),
      );
    if (resolved.length)
      await db
        .from("pulse_queue_items")
        .update({ resolved_at: now.toISOString() })
        .eq("user_id", userId)
        .eq("scope", scope)
        .is("resolved_at", null)
        .in("kind", resolved);
  } catch (error) {
    console.error("[pulse-queue-log] could not record queue state", error);
  }
}
