import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { verifyCandidateUploadToken } from "@/lib/candidate-upload-token";
import { readCv, attachCv } from "@/lib/candidate-cv";
import { ApplicationError } from "@/lib/application-error";
import { checkRateLimit, rateLimitHeaders, requestIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const formData = await req.formData();
  const file = formData.get("cv") as File | null;
  const candidateId = formData.get("candidateId") as string;
  const jobId = formData.get("jobId") as string;
  const uploadToken = formData.get("uploadToken") as string | null;

  if (!file || !candidateId || !jobId) {
    return NextResponse.json(
      { error: "cv, candidateId, jobId required" },
      { status: 400 },
    );
  }

  const limit = await checkRateLimit({
    scope: "cv-upload",
    identifier: `${requestIp(req.headers)}:${candidateId}`,
    limit: 5,
    windowSeconds: 60 * 60,
  });
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Too many CV upload attempts. Please try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );

  const hasPublicUploadAuthority = verifyCandidateUploadToken(
    uploadToken,
    candidateId,
    jobId,
  );
  if (!session && !hasPublicUploadAuthority)
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (
    session &&
    !hasPublicUploadAuthority &&
    !can(session.user.role, "manage_hiring")
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: candidate } = await supabaseAdmin
    .from("candidates")
    .select("id")
    .eq("id", candidateId)
    .eq("job_id", jobId)
    .maybeSingle();
  if (!candidate)
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  try {
    const readable = await readCv(file);
    const stored = await attachCv(candidateId, jobId, readable);
    return NextResponse.json({
      cv_url: stored.cvUrl,
      queuedForScreening: stored.queuedForScreening,
    });
  } catch (error) {
    if (error instanceof ApplicationError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    throw error;
  }
}
