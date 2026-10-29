import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { redis, SCREENING_QUEUE } from "@/lib/redis";

// POST /api/hire/candidates/screen-queue
// Body: { candidateIds: string[] } — enqueue for background screening
// GET  — returns queue depth + list of pending IDs

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { candidateIds } = (await req.json()) as { candidateIds: string[] };
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) {
    return NextResponse.json(
      { error: "candidateIds required" },
      { status: 400 },
    );
  }
  if (candidateIds.length > 100) {
    return NextResponse.json({ error: "Max 100 per batch" }, { status: 400 });
  }

  // Only enqueue candidates that have CV data and haven't been screened
  const { data } = await supabaseAdmin
    .from("candidates")
    .select("id, ai_score, cv_text, cv_parsed")
    .in("id", candidateIds);

  const eligible = (data ?? []).filter(
    (c) => c.ai_score === null && (c.cv_text || c.cv_parsed),
  );

  if (eligible.length === 0) {
    return NextResponse.json({
      queued: 0,
      message: "No eligible candidates (already screened or no CV)",
    });
  }

  // RPUSH so worker processes in FIFO order
  await redis.rpush(SCREENING_QUEUE, ...eligible.map((c) => c.id));

  return NextResponse.json({
    queued: eligible.length,
    total: candidateIds.length,
  });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const depth = await redis.llen(SCREENING_QUEUE);
  const pending = depth > 0 ? await redis.lrange(SCREENING_QUEUE, 0, 49) : [];

  return NextResponse.json({ depth, pending });
}
