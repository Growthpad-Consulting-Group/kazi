import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { localClock } from "@/lib/slack-schedule";
import { resolveWallOfFameStage } from "@/lib/wall-of-fame-stage";
import { broadcastWallOfFameChange } from "@/lib/wall-of-fame-realtime";

const managementRoles = new Set(["admin", "hr"]);

function isWindowOpen(closeAt: string | null) {
  return !closeAt || new Date(`${closeAt}T23:59:59`).getTime() >= Date.now();
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    cycleId?: string;
    nomineeId?: string;
    category?: "wow" | "mvp";
    score?: number;
  } | null;
  if (
    !body?.cycleId ||
    !body.nomineeId ||
    !["wow", "mvp"].includes(body.category ?? "") ||
    !Number.isInteger(body.score) ||
    (body.score ?? 0) < 1 ||
    (body.score ?? 0) > 10
  )
    return NextResponse.json(
      { error: "Choose an eligible nominee, award, and score from 1 to 10." },
      { status: 400 },
    );
  if (body.nomineeId === session.user.id)
    return NextResponse.json(
      { error: "You cannot vote for yourself." },
      { status: 400 },
    );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const { data: cycle, error: cycleError } = await db
    .from("wall_of_fame_cycles")
    .select(
      "status, closes_at, team_voting_opens_at, team_voting_closes_at, management_voting_opens_at, management_voting_closes_at",
    )
    .eq("id", body.cycleId)
    .maybeSingle();
  if (cycleError || !cycle)
    return NextResponse.json(
      { error: cycleError?.message ?? "Award cycle not found." },
      { status: 404 },
    );

  const canManage = userCan(session.user, "manage_recognition_campaigns");
  const currentStage = resolveWallOfFameStage(
    cycle,
    localClock(new Date(), "Africa/Nairobi").date,
  );
  const stage =
    currentStage === "management_voting" && canManage
      ? "management"
      : currentStage === "team_voting" &&
          !managementRoles.has(session.user.role)
        ? "team"
        : null;
  if (!stage)
    return NextResponse.json(
      { error: "Voting is not open for your role." },
      { status: 403 },
    );
  const opensAt =
    stage === "team"
      ? cycle.team_voting_opens_at
      : cycle.management_voting_opens_at;
  const closesAt =
    stage === "team"
      ? cycle.team_voting_closes_at
      : cycle.management_voting_closes_at;
  if (opensAt && new Date(`${opensAt}T00:00:00`).getTime() > Date.now())
    return NextResponse.json(
      { error: "This voting window has not opened yet." },
      { status: 409 },
    );
  if (!isWindowOpen(closesAt))
    return NextResponse.json(
      { error: "This voting window has closed." },
      { status: 409 },
    );

  const { data: nomination, error: nominationError } = await db
    .from("wall_of_fame_nominations")
    .select("id")
    .eq("cycle_id", body.cycleId)
    .eq("nominee_id", body.nomineeId)
    .eq("category", body.category)
    .maybeSingle();
  if (nominationError || !nomination)
    return NextResponse.json(
      { error: "This person is not nominated for that award." },
      { status: 403 },
    );

  if (stage === "management") {
    const { data: teamVotes, error } = await db
      .from("wall_of_fame_votes")
      .select("nominee_id, score")
      .eq("cycle_id", body.cycleId)
      .eq("category", body.category)
      .eq("stage", "team");
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    const totals = new Map<string, { total: number; count: number }>();
    for (const vote of teamVotes ?? []) {
      const entry = totals.get(vote.nominee_id) ?? { total: 0, count: 0 };
      entry.total += vote.score;
      entry.count += 1;
      totals.set(vote.nominee_id, entry);
    }
    const finalists = [...totals.entries()]
      .sort(([, a], [, b]) => b.total / b.count - a.total / a.count)
      .slice(0, 3)
      .map(([id]) => id);
    if (!finalists.includes(body.nomineeId))
      return NextResponse.json(
        { error: "Management voting is limited to team-vote finalists." },
        { status: 403 },
      );
  }

  const { error } = await db.from("wall_of_fame_votes").upsert(
    {
      cycle_id: body.cycleId,
      nominee_id: body.nomineeId,
      voter_id: session.user.id,
      category: body.category,
      score: body.score,
      stage,
      created_at: new Date().toISOString(),
    },
    { onConflict: "cycle_id,voter_id,category,stage" },
  );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastWallOfFameChange(body.cycleId).catch(() => {});
  return NextResponse.json({ ok: true });
}
