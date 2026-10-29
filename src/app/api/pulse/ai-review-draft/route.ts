import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { groq, GROQ_MODEL } from "@/lib/ai";
import type { ReviewType } from "@/types/database";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reviewId, revieweeId, reviewType } = (await req.json()) as {
    reviewId: string;
    revieweeId: string;
    reviewType: ReviewType;
  };

  // Get recent check-ins for reviewee
  const { data: checkins } = await supabaseAdmin
    .from("checkins")
    .select("wins, priorities, blockers, mood, week_start")
    .eq("user_id", revieweeId)
    .order("week_start", { ascending: false })
    .limit(8);

  // Get goals
  const { data: goals } = await supabaseAdmin
    .from("goals")
    .select("title, status, progress")
    .eq("owner_id", revieweeId);

  type RawCheckin = {
    wins: string | null;
    priorities: string | null;
    blockers: string | null;
    mood: number | null;
    week_start: string;
  };
  type RawGoal = { title: string; status: string; progress: number };

  const checkinSummary = ((checkins ?? []) as unknown as RawCheckin[])
    .slice(0, 6)
    .map(
      (c) =>
        `Week ${c.week_start}: wins="${c.wins ?? "—"}" blockers="${c.blockers ?? "—"}" mood=${c.mood ?? "—"}`,
    )
    .join("\n");

  const goalsSummary = ((goals ?? []) as unknown as RawGoal[])
    .map((g) => `- ${g.title} (${g.status}, ${g.progress}%)`)
    .join("\n");

  const perspective =
    reviewType === "self"
      ? "the employee writing their own review"
      : reviewType === "peer"
        ? "a peer colleague"
        : "the direct manager";

  const prompt = `You are helping ${perspective} draft a performance review. The review is based on the reviewee's recent activity.

Recent check-ins (anonymised):
${checkinSummary || "No check-in data available"}

Goals:
${goalsSummary || "No goals recorded"}

Write a concise, honest and constructive performance review draft (3–4 paragraphs). Identify:
1. Key strengths demonstrated this period
2. Significant achievements and contributions
3. Areas for growth and development
4. Overall impression

Return JSON: {"draft": "...", "strengths": "one sentence", "developmentAreas": "one sentence"}`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 800,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let result: { draft: string; strengths: string; developmentAreas: string };
  try {
    result = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "AI returned invalid JSON" },
      { status: 500 },
    );
  }

  // Save draft to the review record
  await supabaseAdmin
    .from("performance_reviews")
    .update({ ai_draft: result.draft })
    .eq("id", reviewId);

  await invalidateTables("performance_reviews");
  return NextResponse.json(result);
}
