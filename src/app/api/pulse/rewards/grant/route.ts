import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { awardPoints } from "@/lib/award-points";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_rewards")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as { user_id?: unknown; points?: unknown; reason?: unknown };
  const { user_id, points, reason } = body;

  // Validate inputs
  if (typeof user_id !== "string" || !UUID_REGEX.test(user_id)) {
    return NextResponse.json({ error: "Invalid user_id — must be a UUID." }, { status: 400 });
  }
  if (typeof points !== "number" || !Number.isInteger(points) || points < 1 || points > 10000) {
    return NextResponse.json({ error: "Points must be an integer between 1 and 10 000." }, { status: 400 });
  }
  if (typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "Reason is required." }, { status: 400 });
  }

  // Verify user exists and is active
  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("id", user_id)
    .eq("is_active", true)
    .maybeSingle();

  if (!targetUser) {
    return NextResponse.json({ error: "User not found or inactive." }, { status: 404 });
  }

  await awardPoints({
    userId: user_id,
    amount: points,
    reason: reason.trim(),
    referenceType: "manual_grant",
    createdBy: session.user.id,
  });

  return NextResponse.json({ ok: true });
}
