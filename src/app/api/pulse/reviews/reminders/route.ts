import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyOutstandingReviewers } from "@/lib/reviews";

export const runtime = "nodejs";

const REMINDER_WINDOW_DAYS = 3;
const ACTIVE_STAGES = ["self_review", "manager_review", "peer_review"] as const;
const DAY_MS = 86_400_000;

/**
 * Scheduled by GitHub Actions (review-reminders.yml). Reminds reviewers who still owe a review
 * when a cycle's current stage is due within a few days or is already overdue.
 */
export async function POST(request: Request) {
  if (!hasCronAccess(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cycles, error } = await supabaseAdmin
    .from("review_cycles")
    .select("id, title, status, end_date")
    .in("status", [...ACTIVE_STAGES]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const today = Date.parse(new Date().toISOString().slice(0, 10));
  let reminded = 0;
  for (const cycle of (cycles ?? []) as { id: string; title: string; status: (typeof ACTIVE_STAGES)[number]; end_date: string }[]) {
    const daysLeft = Math.round((Date.parse(cycle.end_date) - today) / DAY_MS);
    if (daysLeft > REMINDER_WINDOW_DAYS) continue;
    reminded += await notifyOutstandingReviewers(cycle.id, cycle.status, {
      cycleTitle: cycle.title,
      dueDate: cycle.end_date,
      overdue: daysLeft < 0,
      opening: false,
    });
  }

  return NextResponse.json({ ok: true, reminded });
}
