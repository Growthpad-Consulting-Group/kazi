import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_KEY_LENGTH = 300;

/** Push endpoints are always HTTPS URLs issued by the browser's push service. */
function parseEndpoint(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_KEY_LENGTH
    ? value
    : null;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
    keys?: { p256dh?: unknown; auth?: unknown };
  } | null;
  const endpoint = parseEndpoint(body?.endpoint);
  const p256dh = readString(body?.keys?.p256dh);
  const auth = readString(body?.keys?.auth);
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Invalid push subscription" },
      { status: 400 },
    );
  }

  // The same browser re-subscribing updates its keys and owner.
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      user_id: session.user.id,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  );
  if (error)
    return NextResponse.json(
      { error: "Could not save this device" },
      { status: 500 },
    );

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
  } | null;
  const endpoint = parseEndpoint(body?.endpoint);
  if (!endpoint)
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });

  // Only the owner can remove a subscription.
  const { error } = await supabaseAdmin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", session.user.id);
  if (error)
    return NextResponse.json(
      { error: "Could not turn off this device" },
      { status: 500 },
    );

  return NextResponse.json({ ok: true });
}
