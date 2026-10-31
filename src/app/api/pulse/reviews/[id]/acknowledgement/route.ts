import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const body = (await req.json().catch(() => null)) as {
    response?: unknown;
  } | null;
  if (
    body?.response !== undefined &&
    (typeof body.response !== "string" || body.response.length > 2000)
  )
    return NextResponse.json(
      { error: "Your response must be 2,000 characters or fewer." },
      { status: 400 },
    );

  const { data: review } = await supabaseAdmin
    .from("performance_reviews")
    .select("cycle_id, reviewee_id")
    .eq("id", id)
    .maybeSingle();
  if (!review || review.reviewee_id !== session.user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed release field
  const db = supabaseAdmin as any;
  const { data: cycle } = await db
    .from("review_cycles")
    .select("results_released_at")
    .eq("id", review.cycle_id)
    .maybeSingle();
  if (!cycle?.results_released_at)
    return NextResponse.json(
      { error: "Final feedback has not been released yet." },
      { status: 409 },
    );

  const { error } = await db
    .from("performance_reviews")
    .update({
      employee_acknowledged_at: new Date().toISOString(),
      employee_response:
        typeof body?.response === "string"
          ? body.response.trim() || null
          : null,
    })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed audit table
  await (supabaseAdmin as any).from("performance_review_audit_logs").insert({
    cycle_id: review.cycle_id,
    review_id: id,
    actor_id: session.user.id,
    action: "employee_acknowledged",
  });
  await invalidateTables("performance_reviews");
  return NextResponse.json({ ok: true });
}
