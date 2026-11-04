import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getAsanaAccessToken } from "@/lib/asana-completed-tasks";
import { asanaEventKey, type AsanaEvent } from "@/lib/asana-webhook";

// Webhook delivery is at-most-once, so this pulls the event log for each subscribed project
// and stores anything missed. Event keys make overlaps with webhook deliveries harmless.
export async function POST(request: Request) {
  if (!hasCronAccess(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const { data: subs } = await db
    .from("asana_webhook_subscriptions")
    .select("id, project_gid, sync_token, created_by")
    .eq("status", "active");

  let stored = 0;
  let failed = 0;
  for (const sub of (subs ?? []) as {
    id: string;
    project_gid: string;
    sync_token: string | null;
    created_by: string | null;
  }[]) {
    const access = sub.created_by
      ? await getAsanaAccessToken({
          userId: sub.created_by,
          origin: new URL(request.url).origin,
        }).catch(() => ({ connected: false as const }))
      : { connected: false as const };
    if (!access.connected) {
      failed += 1;
      continue;
    }
    const query = new URLSearchParams({ resource: sub.project_gid });
    if (sub.sync_token) query.set("sync", sub.sync_token);
    const response = await fetch(
      `https://app.asana.com/api/1.0/events?${query}`,
      {
        headers: { Authorization: `Bearer ${access.accessToken}` },
      },
    ).catch(() => null);
    const body = (await response?.json().catch(() => null)) as {
      data?: AsanaEvent[];
      sync?: string;
    } | null;

    // 412 means the saved sync token has expired: start again from the newest token.
    if (response?.status === 412) {
      await db
        .from("asana_webhook_subscriptions")
        .update({ sync_token: body?.sync ?? null })
        .eq("id", sub.id);
      continue;
    }
    if (!response?.ok) {
      failed += 1;
      continue;
    }
    const rows = (body?.data ?? []).flatMap((event) => {
      const key = asanaEventKey(event);
      if (!key || !event.action || !event.resource?.gid) return [];
      return [
        {
          subscription_id: sub.id,
          event_key: key,
          action: event.action,
          resource_gid: event.resource.gid,
          source: "reconciliation",
        },
      ];
    });
    if (rows.length) {
      await db
        .from("asana_task_events")
        .upsert(rows, { onConflict: "event_key", ignoreDuplicates: true });
      stored += rows.length;
    }
    await db
      .from("asana_webhook_subscriptions")
      .update({
        sync_token: body?.sync ?? sub.sync_token,
        last_reconciled_at: new Date().toISOString(),
      })
      .eq("id", sub.id);
  }
  return NextResponse.json({
    ok: true,
    subscriptions: (subs ?? []).length,
    stored,
    failed,
  });
}
