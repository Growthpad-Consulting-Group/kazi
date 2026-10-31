import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_pips")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    user_id,
    concern,
    expected_outcomes,
    support_provided,
    check_in_frequency,
    start_date,
    review_date,
  } = await req.json();

  if (
    !user_id ||
    !concern?.trim() ||
    !expected_outcomes?.trim() ||
    !start_date
  ) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }
  if (session.user.role === "manager") {
    const { data: employee } = await supabaseAdmin
      .from("users")
      .select("manager_id")
      .eq("id", user_id)
      .maybeSingle();
    if (employee?.manager_id !== session.user.id)
      return NextResponse.json(
        {
          error:
            "Managers can create support plans only for their direct reports.",
        },
        { status: 403 },
      );
  }
  if (review_date && review_date < start_date) {
    return NextResponse.json(
      { error: "The review date must be on or after the start date." },
      { status: 400 },
    );
  }

  // New plans remain pending until the employee has seen and acknowledged them.
  // An HR/admin exception is handled separately on the plan record for auditability.
  const { data, error } = await (supabaseAdmin as any)
    .from("pips")
    .insert({
      user_id,
      manager_id: session.user.id,
      concern,
      expected_outcomes,
      support_provided: support_provided || null,
      check_in_frequency: check_in_frequency || null,
      start_date,
      review_date: review_date || null,
      actions: [],
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("pips");
  return NextResponse.json(data);
}
