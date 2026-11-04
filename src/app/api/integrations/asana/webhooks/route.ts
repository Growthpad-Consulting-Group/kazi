import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptAsanaToken, encryptAsanaToken } from "@/lib/asana";
import {
  asanaEventKey,
  verifyAsanaWebhookSignature,
  type AsanaEvent,
} from "@/lib/asana-webhook";

// Receives Asana's handshake and event deliveries for one registered project.
// The registration token in the URL identifies the subscription; it is random and secret.
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("reg") ?? "";
  if (!/^[A-Za-z0-9_-]{32,96}$/.test(token))
    return new NextResponse(null, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const { data: sub } = await db
    .from("asana_webhook_subscriptions")
    .select("id, status, secret_ciphertext")
    .eq("registration_token", token)
    .maybeSingle();
  if (!sub) return new NextResponse(null, { status: 404 });

  // Handshake: Asana sends its secret once, when the webhook is created. Accept it only while pending.
  const handshake = request.headers.get("x-hook-secret");
  if (handshake) {
    if (sub.status !== "pending")
      return new NextResponse(null, { status: 409 });
    await db
      .from("asana_webhook_subscriptions")
      .update({
        secret_ciphertext: encryptAsanaToken(handshake),
        status: "active",
      })
      .eq("id", sub.id);
    return new NextResponse(null, {
      status: 200,
      headers: { "X-Hook-Secret": handshake },
    });
  }

  if (!sub.secret_ciphertext) return new NextResponse(null, { status: 401 });
  const raw = await request.text();
  const secret = decryptAsanaToken(sub.secret_ciphertext);
  if (
    !verifyAsanaWebhookSignature(
      secret,
      raw,
      request.headers.get("x-hook-signature"),
    )
  )
    return new NextResponse(null, { status: 401 });

  let events: AsanaEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: AsanaEvent[] }).events ?? [];
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const rows = events.flatMap((event) => {
    const key = asanaEventKey(event);
    if (!key || !event.action || !event.resource?.gid) return [];
    return [
      {
        subscription_id: sub.id,
        event_key: key,
        action: event.action,
        resource_gid: event.resource.gid,
        source: "webhook",
      },
    ];
  });
  if (rows.length) {
    // Duplicate deliveries are ignored, so retries never store an event twice.
    await db
      .from("asana_task_events")
      .upsert(rows, { onConflict: "event_key", ignoreDuplicates: true });
    await db
      .from("asana_webhook_subscriptions")
      .update({ last_event_at: new Date().toISOString() })
      .eq("id", sub.id);
  }
  // Acknowledge quickly; Asana retries if this does not answer in time.
  return new NextResponse(null, { status: 200 });
}
