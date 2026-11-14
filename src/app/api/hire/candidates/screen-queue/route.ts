import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { enqueueScreeningCandidate, redis, SCREENING_QUEUE } from "@/lib/redis";
import {
  assertHireCandidateBatchAccess,
  canManageHireCompany,
  getHireCompanyAccess,
} from "@/lib/hire-company-access";

// POST /api/hire/candidates/screen-queue
// Body: { candidateIds: string[] } — enqueue for background screening
// GET  — returns queue depth + list of pending IDs

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
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
  try {
    await assertHireCandidateBatchAccess({
      userId: session.user.id,
      userRole: session.user.role,
      candidateIds,
      minimumRole: "hiring_manager",
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Only enqueue candidates that have CV data and haven't been screened
  const { data } = await supabaseAdmin
    .from("candidates")
    .select("id, ai_score, cv_url, cv_text, cv_parsed")
    .in("id", candidateIds);

  const eligible = (data ?? []).filter(
    (c) => c.ai_score === null && (c.cv_url || c.cv_text || c.cv_parsed),
  );

  if (eligible.length === 0) {
    return NextResponse.json({
      queued: 0,
      message: "No eligible candidates (already screened or no CV)",
    });
  }

  // The list remains FIFO, while the pending set prevents duplicate entries.
  const queued = await Promise.all(
    eligible.map((candidate) => enqueueScreeningCandidate(candidate.id)),
  );
  const queuedCount = queued.filter(Boolean).length;

  return NextResponse.json({
    queued: queuedCount,
    alreadyQueued: eligible.length - queuedCount,
    total: candidateIds.length,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyIds = (
    await getHireCompanyAccess(session.user.id, session.user.role)
  )
    .filter((access) => canManageHireCompany(access.role))
    .map((access) => access.companyId);
  if (companyIds.length === 0)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const depth = await redis.llen(SCREENING_QUEUE);
  const pendingIds =
    depth > 0 ? await redis.lrange(SCREENING_QUEUE, 0, 49) : [];
  const { data: pendingRows } = pendingIds.length
    ? await supabaseAdmin
        .from("candidates")
        .select("id")
        .in("id", pendingIds)
        .in("company_id", companyIds)
    : { data: [] };
  const pending = (pendingRows ?? []).map((candidate) => candidate.id);

  return NextResponse.json({ depth: pending.length, pending });
}
