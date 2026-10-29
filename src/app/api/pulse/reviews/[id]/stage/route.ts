import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import {
  NEXT_REVIEW_STATUS,
  generateCycleReviews,
  notifyOutstandingReviewers,
} from "@/lib/reviews";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_reviews"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;

  const { data: cycle } = await supabaseAdmin
    .from("review_cycles")
    .select("status, title, end_date")
    .eq("id", id)
    .maybeSingle();
  if (!cycle)
    return NextResponse.json(
      { error: "Review cycle not found." },
      { status: 404 },
    );
  const {
    status: current,
    title,
    end_date,
  } = cycle as {
    status: keyof typeof NEXT_REVIEW_STATUS | "completed";
    title: string;
    end_date: string;
  };
  if (current === "completed")
    return NextResponse.json(
      { error: "This cycle is already complete." },
      { status: 409 },
    );

  const next = NEXT_REVIEW_STATUS[current];
  if (current === "pending") await generateCycleReviews(id);

  const { error } = await supabaseAdmin
    .from("review_cycles")
    .update({ status: next })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("review_cycles", "performance_reviews");
  if (next !== "completed") {
    await notifyOutstandingReviewers(id, next, {
      cycleTitle: title,
      dueDate: end_date,
      overdue: false,
      opening: true,
    });
  }
  return NextResponse.json({ status: next });
}
