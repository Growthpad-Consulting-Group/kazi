import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import type { RedemptionStatus } from "@/types/database";

const ALLOWED_STATUSES: RedemptionStatus[] = [
  "approved",
  "fulfilled",
  "rejected",
];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_rewards")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { status, notes } = await req.json();

  if (!ALLOWED_STATUSES.includes(status as RedemptionStatus)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  // Nobody approves or fulfils their own redemption, and admins' redemptions go to HR.
  const { data: redemption, error: lookupError } = await supabaseAdmin
    .from("reward_redemptions")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (lookupError)
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  if (!redemption)
    return NextResponse.json(
      { error: "Redemption not found." },
      { status: 404 },
    );
  const requesterId = (redemption as { user_id: string }).user_id;
  if (requesterId === session.user.id) {
    return NextResponse.json(
      {
        error:
          "You can't approve or fulfil your own redemption. Another admin or HR must handle it.",
      },
      { status: 403 },
    );
  }
  const { data: requester } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", requesterId)
    .maybeSingle();
  if (
    (requester as { role: string } | null)?.role === "admin" &&
    session.user.role !== "hr"
  ) {
    return NextResponse.json(
      { error: "Admins' redemptions are approved by HR." },
      { status: 403 },
    );
  }

  const { error } = await supabaseAdmin
    .from("reward_redemptions")
    .update({
      status: status as RedemptionStatus,
      approved_by: session.user.id,
      fulfilled_at: status === "fulfilled" ? new Date().toISOString() : null,
      notes: notes ?? null,
    })
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
