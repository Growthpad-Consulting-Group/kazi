import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { user_id, concern, expected_outcomes, support_provided, check_in_frequency, start_date, review_date } = await req.json();

  if (!user_id || !concern || !expected_outcomes || !start_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.from("pips").insert({
    user_id,
    manager_id: session.user.id,
    concern,
    expected_outcomes,
    support_provided: support_provided || null,
    check_in_frequency: check_in_frequency || null,
    start_date,
    review_date: review_date || null,
    actions: [],
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("pips");
  return NextResponse.json(data);
}
