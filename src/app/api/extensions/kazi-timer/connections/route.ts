import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- migration is newer than generated database types.
  const { data, error } = await db
    .from("browser_extension_tokens")
    .select("id, client_name, created_at, last_used_at, expires_at")
    .eq("user_id", session.user.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json(
      { error: "Could not load extension connections" },
      { status: 500 },
    );
  return NextResponse.json({ connections: data ?? [] });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !UUID.test(id))
    return NextResponse.json({ error: "Invalid connection" }, { status: 400 });
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- migration is newer than generated database types.
  const { error } = await db
    .from("browser_extension_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .is("revoked_at", null);
  if (error)
    return NextResponse.json(
      { error: "Could not revoke extension connection" },
      { status: 500 },
    );
  return NextResponse.json({ ok: true });
}
