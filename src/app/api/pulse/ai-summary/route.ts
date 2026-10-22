import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateUserCheckins } from "@/lib/cache/invalidate";
import { groq, GROQ_MODEL } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_checkins")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { weekStart } = await req.json();
  if (!weekStart) return NextResponse.json({ error: "weekStart required" }, { status: 400 });

  // Get direct reports
  const { data: reports } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("manager_id", session.user.id);
  const ids = (reports ?? []).map((r) => r.id as string);
  if (!ids.length) return NextResponse.json({ error: "No direct reports" }, { status: 400 });

  const { data: checkins } = await supabaseAdmin
    .from("checkins")
    .select("user_id, wins, priorities, blockers, mood")
    .in("user_id", ids)
    .eq("week_start", weekStart);

  const reportNames = Object.fromEntries(
    (reports ?? []).map((r) => [r.id, r.name as string])
  );

  type RawCheckin = { user_id: string; wins: string | null; priorities: string | null; blockers: string | null; mood: number | null };
  const rows = (checkins ?? []) as unknown as RawCheckin[];

  if (!rows.length) return NextResponse.json({ error: "No check-ins submitted yet" }, { status: 400 });

  const checkinText = rows.map((c) =>
    `${reportNames[c.user_id] ?? "Unknown"}: wins="${c.wins ?? "—"}" priorities="${c.priorities ?? "—"}" blockers="${c.blockers ?? "—"}" mood=${c.mood ?? "—"}`
  ).join("\n");

  const prompt = `You are an AI assistant helping a manager review their team's weekly check-ins.

Team check-ins for week of ${weekStart}:
${checkinText}

Write a concise manager summary (3–5 sentences) covering:
1. Overall team energy / mood this week
2. Key wins to celebrate
3. Blockers or themes that need attention
4. Any patterns worth discussing

Be direct and specific. Do not list names unnecessarily — focus on themes.`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
  });

  const summary = completion.choices[0]?.message?.content ?? "";

  // Save ai_summary back to each checkin
  for (const c of rows) {
    await supabaseAdmin
      .from("checkins")
      .update({ ai_summary: summary })
      .eq("user_id", c.user_id)
      .eq("week_start", weekStart);
  }

  // Only the check-ins that were just summarised went stale.
  for (const c of rows) {
    await invalidateUserCheckins(c.user_id);
  }
  return NextResponse.json({ summary });
}
