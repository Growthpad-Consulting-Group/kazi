import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- passkeys table is migration-backed and awaits generated types
  const { data, error } = await (supabaseAdmin as any)
    .from("passkeys")
    .select("id, device_type, backed_up, transports, created_at, last_used_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ passkeys: data ?? [] });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    id?: string;
  } | null;
  if (!body?.id)
    return NextResponse.json(
      { error: "A passkey is required." },
      { status: 400 },
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- passkeys table is migration-backed and awaits generated types
  const { error } = await (supabaseAdmin as any)
    .from("passkeys")
    .delete()
    .eq("id", body.id)
    .eq("user_id", session.user.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
