import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateOneOnOneParticipants } from "@/lib/cache/invalidate";
import { groq, GROQ_MODEL } from "@/lib/ai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "manager")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { oneOnOneId } = await req.json();
  if (!oneOnOneId) return NextResponse.json({ error: "oneOnOneId required" }, { status: 400 });

  const { data: oo } = await supabaseAdmin
    .from("one_on_ones")
    .select("report_id, action_items, notes")
    .eq("id", oneOnOneId)
    .single();

  if (!oo) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ooTyped = oo as unknown as { report_id: string; action_items: { text: string; done: boolean }[]; notes: string | null };

  // Get recent check-ins for the report
  const { data: checkins } = await supabaseAdmin
    .from("checkins")
    .select("wins, priorities, blockers, mood, week_start")
    .eq("user_id", ooTyped.report_id)
    .order("week_start", { ascending: false })
    .limit(4);

  const openItems = ooTyped.action_items.filter((a) => !a.done);
  const checkinSummary = (checkins ?? [])
    .map((c) => {
      const cTyped = c as { wins: string | null; priorities: string | null; blockers: string | null; mood: number | null; week_start: string };
      return `Week of ${cTyped.week_start}: wins="${cTyped.wins ?? "—"}" priorities="${cTyped.priorities ?? "—"}" blockers="${cTyped.blockers ?? "—"}" mood=${cTyped.mood ?? "—"}`;
    })
    .join("\n");

  const prompt = `You are helping a manager prepare for a 1-on-1. Based on the team member's recent check-ins and open action items, suggest 4–6 concise talking points.

Recent check-ins:
${checkinSummary || "None available"}

Open action items from previous sessions:
${openItems.map((a) => `- ${a.text}`).join("\n") || "None"}

Return a plain numbered list of talking points. Be specific and practical. Focus on blockers, momentum and growth.`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 512,
  });

  const points = completion.choices[0]?.message?.content ?? "";

  // Save to one_on_one record
  await supabaseAdmin.from("one_on_ones").update({ ai_talking_points: points }).eq("id", oneOnOneId);

  // Only the two participants' cached one-on-one lists went stale.
  const { data: existing } = await supabaseAdmin
    .from("one_on_ones")
    .select("manager_id, report_id")
    .eq("id", oneOnOneId)
    .maybeSingle();
  const participants = existing as unknown as {
    manager_id: string | null;
    report_id: string | null;
  } | null;
  await invalidateOneOnOneParticipants({
    managerId: participants?.manager_id ?? undefined,
    reportId: participants?.report_id ?? undefined,
  });
  return NextResponse.json({ points });
}
