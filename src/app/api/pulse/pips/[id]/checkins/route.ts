import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    note?: unknown;
    acknowledge?: boolean;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed activation field
  const { data: pip } = await (supabaseAdmin as any)
    .from("pips")
    .select("user_id, manager_id, hr_id, activated_at")
    .eq("id", id)
    .maybeSingle();
  if (!pip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const canAccess =
    pip.user_id === session.user.id ||
    pip.manager_id === session.user.id ||
    pip.hr_id === session.user.id ||
    ["admin", "hr"].includes(session.user.role);
  if (!canAccess)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (body?.acknowledge) {
    if (pip.user_id !== session.user.id)
      return NextResponse.json(
        { error: "Only the employee can acknowledge this plan." },
        { status: 403 },
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed field
    const { error } = await (supabaseAdmin as any)
      .from("pips")
      .update({
        employee_acknowledged_at: new Date().toISOString(),
        activated_at: pip.activated_at ?? new Date().toISOString(),
      })
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (
    typeof body?.note !== "string" ||
    !body.note.trim() ||
    body.note.length > 3000
  )
    return NextResponse.json(
      { error: "Enter a check-in note up to 3,000 characters." },
      { status: 400 },
    );
  if (!pip.activated_at)
    return NextResponse.json(
      { error: "This plan becomes active once the employee acknowledges it." },
      { status: 409 },
    );
  const { error } = await (supabaseAdmin as any)
    .from("pip_checkins")
    .insert({ pip_id: id, author_id: session.user.id, note: body.note.trim() });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
