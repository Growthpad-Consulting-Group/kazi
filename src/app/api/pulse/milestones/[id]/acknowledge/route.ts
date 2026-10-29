import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_one_on_ones")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { data: milestone, error: milestoneError } = await supabaseAdmin
    .from("milestones")
    .select("id, user_id, acknowledged")
    .eq("id", id)
    .maybeSingle();
  if (milestoneError)
    return NextResponse.json(
      { error: milestoneError.message },
      { status: 500 },
    );
  if (!milestone)
    return NextResponse.json({ error: "Milestone not found" }, { status: 404 });
  if (milestone.acknowledged)
    return NextResponse.json(
      { error: "This milestone has already been acknowledged" },
      { status: 409 },
    );

  const canManageAll = can(session.user.role, "manage_recognition_campaigns");
  if (!canManageAll) {
    const { data: staffMember, error: staffError } = await supabaseAdmin
      .from("users")
      .select("manager_id")
      .eq("id", milestone.user_id)
      .maybeSingle();
    if (staffError)
      return NextResponse.json({ error: staffError.message }, { status: 500 });
    if (staffMember?.manager_id !== session.user.id) {
      return NextResponse.json(
        {
          error: "You can only acknowledge milestones for your direct reports",
        },
        { status: 403 },
      );
    }
  }

  const { error } = await supabaseAdmin
    .from("milestones")
    .update({
      acknowledged: true,
      acknowledged_by: session.user.id,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("acknowledged", false);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await invalidateTables("milestones");
  return NextResponse.json({ ok: true });
}
