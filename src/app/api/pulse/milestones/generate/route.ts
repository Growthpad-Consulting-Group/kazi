import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request): Promise<Response> {
  // Auth: Bearer CRON_SECRET
  const auth = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const currentYear = today.getFullYear();

  let created = 0;

  // ── 1. Work anniversaries in the next 7 days ──────────────────────────────
  const { data: activeUsers } = await supabaseAdmin
    .from("users")
    .select("id, start_date, created_at")
    .eq("is_active", true)
    .not("start_date", "is", null);

  const windowEnd = new Date(today);
  windowEnd.setDate(today.getDate() + 6);

  for (const user of activeUsers ?? []) {
    if (!user.start_date) continue;

    const [startYear, startMonth, startDay] = user.start_date.split("-").map(Number);
    // Anniversary this year
    const anniversaryThisYear = new Date(currentYear, startMonth - 1, startDay);
    const anniversaryStr = anniversaryThisYear.toISOString().slice(0, 10);

    // Check if anniversary falls within today..today+6
    if (anniversaryThisYear >= today && anniversaryThisYear <= windowEnd) {
      const yearsCount = currentYear - startYear;
      if (yearsCount > 0) {
        const { error } = await supabaseAdmin.from("milestones").upsert(
          {
            user_id: user.id,
            type: "work_anniversary",
            milestone_date: anniversaryStr,
            years_count: yearsCount,
          },
          { onConflict: "user_id,type,milestone_date", ignoreDuplicates: true }
        );
        if (!error) created++;
      }
    }
  }

  // ── 2. Onboarding complete: created in last 30 days with at least 1 check-in ─
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);

  const { data: newUsers } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("is_active", true)
    .gte("created_at", thirtyDaysAgo.toISOString());

  for (const user of newUsers ?? []) {
    const { count } = await supabaseAdmin
      .from("checkins")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) > 0) {
      const { error } = await supabaseAdmin.from("milestones").upsert(
        {
          user_id: user.id,
          type: "onboarding_complete",
          milestone_date: todayStr,
        },
        { onConflict: "user_id,type,milestone_date", ignoreDuplicates: true }
      );
      if (!error) created++;
    }
  }

  return NextResponse.json({ ok: true, created });
}
