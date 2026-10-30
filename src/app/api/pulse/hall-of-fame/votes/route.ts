import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { broadcastHallOfFameChange } from "@/lib/hall-of-fame-realtime";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    cycleId?: string;
    nomineeId?: string;
    category?: string;
    score?: number;
  } | null;
  const score = body?.score;
  if (
    !body?.cycleId ||
    !body.nomineeId ||
    !["wow", "mvp"].includes(body.category ?? "") ||
    typeof score !== "number" ||
    !Number.isInteger(score) ||
    score < 1 ||
    score > 10
  )
    return NextResponse.json(
      { error: "Choose a nominee, award, and a score from 1 to 10." },
      { status: 400 },
    );
  if (body.nomineeId === session.user.id)
    return NextResponse.json(
      { error: "You cannot vote for yourself." },
      { status: 400 },
    );
  const db = supabaseAdmin as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{ data: { status: string } | null }>;
        };
      };
      upsert: (
        value: unknown,
        options: unknown,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
  const { data: cycle } = await db
    .from("hall_of_fame_cycles")
    .select("status")
    .eq("id", body.cycleId)
    .maybeSingle();
  const management = userCan(session.user, "manage_recognition_campaigns");
  const stage =
    cycle?.status === "management_voting" && management
      ? "management"
      : cycle?.status === "team_voting"
        ? "team"
        : null;
  if (!stage)
    return NextResponse.json(
      { error: "Voting is not open for your role." },
      { status: 409 },
    );
  const { error } = await db.from("hall_of_fame_votes").upsert(
    {
      cycle_id: body.cycleId,
      nominee_id: body.nomineeId,
      voter_id: session.user.id,
      category: body.category,
      score: score as number,
      stage,
    },
    { onConflict: "cycle_id,nominee_id,voter_id,category,stage" },
  );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await broadcastHallOfFameChange(body.cycleId).catch(() => {});
  return NextResponse.json({ ok: true });
}
