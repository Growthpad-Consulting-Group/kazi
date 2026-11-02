import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

const db = supabaseAdmin as any;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_checkins"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let staffQuery = supabaseAdmin
    .from("users")
    .select("id, name, avatar_url")
    .eq("is_active", true);
  if (session.user.role === "manager")
    staffQuery = staffQuery.eq("manager_id", session.user.id);
  const { data: staff } = await staffQuery;
  const ids = (staff ?? []).map((person) => person.id);
  if (!ids.length) return NextResponse.json({ requests: [] });
  const { data, error } = await db
    .from("overtime_requests")
    .select(
      "id, user_id, log_date, task, start_time, end_time, outside_minutes, reason, status, resolution, manager_note, created_at",
    )
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const names = new Map((staff ?? []).map((person) => [person.id, person]));
  return NextResponse.json({
    requests: (data ?? []).map((request: any) => ({
      ...request,
      staff: names.get(request.user_id) ?? null,
    })),
  });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_checkins"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    status?: string;
    resolution?: string;
    managerNote?: string;
  } | null;
  if (!body?.id || !["approved", "declined"].includes(body.status ?? ""))
    return NextResponse.json(
      { error: "Choose a valid decision." },
      { status: 400 },
    );
  if (
    body.status === "approved" &&
    !["time_off_in_lieu", "payroll_compensation"].includes(
      body.resolution ?? "",
    )
  )
    return NextResponse.json(
      { error: "Choose time off in lieu or payroll compensation." },
      { status: 400 },
    );
  const { data: overtime } = await db
    .from("overtime_requests")
    .select("user_id")
    .eq("id", body.id)
    .maybeSingle();
  if (!overtime)
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  if (session.user.role === "manager") {
    const { data: staff } = await supabaseAdmin
      .from("users")
      .select("manager_id")
      .eq("id", overtime.user_id)
      .maybeSingle();
    if (staff?.manager_id !== session.user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await db
    .from("overtime_requests")
    .update({
      status: body.status,
      resolution: body.status === "approved" ? body.resolution : null,
      manager_note:
        typeof body.managerNote === "string"
          ? body.managerNote.trim().slice(0, 1000) || null
          : null,
      reviewed_by: session.user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", body.id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await supabaseAdmin.from("notifications").insert({
    user_id: overtime.user_id,
    message:
      body.status === "approved"
        ? `Your outside-hours work was approved for ${body.resolution === "time_off_in_lieu" ? "time off in lieu" : "payroll compensation"}.`
        : "Your outside-hours work request was declined.",
    link: "/pulse/checkins?tab=daily",
  });
  return NextResponse.json({ ok: true });
}
