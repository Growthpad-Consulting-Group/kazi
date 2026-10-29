import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { hasCronAccess } from "@/lib/cron-auth";

export async function POST(req: Request): Promise<Response> {
  // Auth: Bearer CRON_SECRET
  if (!hasCronAccess(req)) {
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

    const [startYear, startMonth, startDay] = user.start_date
      .split("-")
      .map(Number);
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
          { onConflict: "user_id,type,milestone_date", ignoreDuplicates: true },
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
        { onConflict: "user_id,type,milestone_date", ignoreDuplicates: true },
      );
      if (!error) created++;
    }
  }

  // ── 3. Birthdays in the next 7 days ───────────────────────────────────────
  const { data: dobUsers } = await supabaseAdmin
    .from("users")
    .select("id, date_of_birth")
    .eq("is_active", true)
    .not("date_of_birth", "is", null);

  for (const user of dobUsers ?? []) {
    if (!user.date_of_birth) continue;
    const [, dobMonth, dobDay] = user.date_of_birth.split("-").map(Number);
    const birthdayThisYear = new Date(currentYear, dobMonth - 1, dobDay);
    const birthdayStr = birthdayThisYear.toISOString().slice(0, 10);
    if (birthdayThisYear >= today && birthdayThisYear <= windowEnd) {
      const { error } = await supabaseAdmin
        .from("milestones")
        .upsert(
          { user_id: user.id, type: "birthday", milestone_date: birthdayStr },
          { onConflict: "user_id,type,milestone_date", ignoreDuplicates: true },
        );
      if (!error) created++;
    }
  }

  // ── 4. Service achievements (1, 3, 5, 10 years) ───────────────────────────
  const SERVICE_MILESTONES = [1, 3, 5, 10];
  for (const user of activeUsers ?? []) {
    if (!user.start_date) continue;
    const [startYear, startMonth, startDay] = user.start_date
      .split("-")
      .map(Number);
    for (const years of SERVICE_MILESTONES) {
      if (currentYear - startYear !== years) continue;
      const achievementDate = new Date(currentYear, startMonth - 1, startDay);
      const achievementStr = achievementDate.toISOString().slice(0, 10);
      if (achievementDate >= today && achievementDate <= windowEnd) {
        const { error } = await supabaseAdmin.from("milestones").upsert(
          {
            user_id: user.id,
            type: "service_achievement",
            milestone_date: achievementStr,
            years_count: years,
          },
          {
            onConflict: "user_id,type,milestone_date",
            ignoreDuplicates: true,
          },
        );
        if (!error) created++;
      }
    }
  }

  return NextResponse.json({ ok: true, created });
}
