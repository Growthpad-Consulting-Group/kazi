import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { localClock } from "@/lib/slack-schedule";
import { resolveWallOfFameStage } from "@/lib/wall-of-fame-stage";
import { broadcastWallOfFameChange } from "@/lib/wall-of-fame-realtime";

type Vote = {
  nominee_id: string;
  category: "wow" | "mvp";
  score: number;
  stage: "team" | "management";
};

function averages(votes: Vote[]) {
  const scores = new Map<string, { total: number; count: number }>();
  for (const vote of votes) {
    const entry = scores.get(vote.nominee_id) ?? { total: 0, count: 0 };
    entry.total += vote.score;
    entry.count += 1;
    scores.set(vote.nominee_id, entry);
  }
  return scores;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_recognition_campaigns"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    cycleId?: string;
  } | null;
  if (!body?.cycleId)
    return NextResponse.json(
      { error: "A cycle is required." },
      { status: 400 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables await generated types
  const db = supabaseAdmin as any;
  const { data: cycle } = await db
    .from("wall_of_fame_cycles")
    .select(
      "status, closes_at, team_voting_opens_at, management_voting_opens_at",
    )
    .eq("id", body.cycleId)
    .maybeSingle();
  if (
    !cycle ||
    resolveWallOfFameStage(
      cycle,
      localClock(new Date(), "Africa/Nairobi").date,
    ) !== "management_voting"
  )
    return NextResponse.json(
      { error: "Publish winners after management voting is open." },
      { status: 409 },
    );

  const { data: voteRows, error: votesError } = await db
    .from("wall_of_fame_votes")
    .select("nominee_id, category, score, stage")
    .eq("cycle_id", body.cycleId);
  if (votesError)
    return NextResponse.json({ error: votesError.message }, { status: 500 });

  const winners = (["wow", "mvp"] as const).flatMap((category) => {
    const categoryVotes = ((voteRows ?? []) as Vote[]).filter(
      (vote) => vote.category === category,
    );
    const management = averages(
      categoryVotes.filter((vote) => vote.stage === "management"),
    );
    const team = averages(
      categoryVotes.filter((vote) => vote.stage === "team"),
    );
    const [nomineeId, managementScore] =
      [...management.entries()].sort(
        ([, a], [, b]) => b.total / b.count - a.total / a.count,
      )[0] ?? [];
    if (!nomineeId || !managementScore) return [];
    const teamScore = team.get(nomineeId);
    return [
      {
        cycle_id: body.cycleId,
        nominee_id: nomineeId,
        category,
        team_score: teamScore
          ? Number((teamScore.total / teamScore.count).toFixed(2))
          : null,
        management_score: Number(
          (managementScore.total / managementScore.count).toFixed(2),
        ),
        prize_status: "pending",
        published_at: new Date().toISOString(),
      },
    ];
  });
  if (winners.length === 0)
    return NextResponse.json(
      {
        error:
          "Each award needs at least one management vote before publication.",
      },
      { status: 409 },
    );
  const { error: winnerError } = await db
    .from("wall_of_fame_winners")
    .upsert(winners, { onConflict: "cycle_id,category" });
  if (winnerError)
    return NextResponse.json({ error: winnerError.message }, { status: 500 });
  const { error: cycleError } = await db
    .from("wall_of_fame_cycles")
    .update({ status: "published" })
    .eq("id", body.cycleId);
  if (cycleError)
    return NextResponse.json({ error: cycleError.message }, { status: 500 });
  await broadcastWallOfFameChange(body.cycleId).catch(() => {});
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_recognition_campaigns"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json().catch(() => null)) as {
    id?: string;
    prizeStatus?: "pending" | "ordered" | "delivered";
  } | null;
  if (
    !body?.id ||
    !["pending", "ordered", "delivered"].includes(body.prizeStatus ?? "")
  )
    return NextResponse.json(
      { error: "Choose a valid prize status." },
      { status: 400 },
    );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table awaits generated types
  const db = supabaseAdmin as any;
  const { data: winner, error } = await db
    .from("wall_of_fame_winners")
    .update({ prize_status: body.prizeStatus })
    .eq("id", body.id)
    .select("cycle_id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastWallOfFameChange(winner.cycle_id).catch(() => {});
  return NextResponse.json({ ok: true });
}
