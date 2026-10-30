import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { notifyRoles } from "@/lib/notifications";
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

  const { data, error } = await supabaseAdmin.rpc(
    "process_reward_redemption" as never,
    {
      p_redemption_id: id,
      p_status: status,
      p_actor_id: session.user.id,
      p_notes: typeof notes === "string" ? notes.trim() || null : null,
    } as never,
  );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  const result = data as {
    user_id: string;
    reward_name: string;
    status: RedemptionStatus;
  };
  await supabaseAdmin.from("notifications").insert({
    user_id: result.user_id,
    message: `Reward ${result.status}: ${result.reward_name}${result.status === "rejected" ? " — your points have been refunded" : ""}`,
    link: "/pulse/rewards",
  });
  if (result.status === "approved")
    await notifyRoles(
      ["admin", "hr"],
      `Reward ready to fulfil: ${result.reward_name}`,
      "/pulse/rewards",
    );
  return NextResponse.json({ ok: true });
}
