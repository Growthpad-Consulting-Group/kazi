import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyRoles, RECRUITER_ROLES } from "@/lib/notifications";
import { invalidateTables } from "@/lib/cache/invalidate";
import { createCandidateUploadToken } from "@/lib/candidate-upload-token";

// Public endpoint — no auth. Called by the public /apply/[jobId] page.
export async function POST(req: Request) {
  const body = await req.json();
  const { job_id, full_name, email, phone, location, linkedin_url, portfolio_url, cover_message, source, consented } = body;

  if (!job_id || !full_name || !email || !consented) {
    return NextResponse.json(
      { error: "job_id, full_name, email and consent are required" },
      { status: 400 }
    );
  }

  // Verify job exists and is open
  const { data: job } = await supabaseAdmin
    .from("jobs")
    .select("id, status, title, published_at, closes_at")
    .eq("id", job_id)
    .single();

  const now = new Date();
  if (
    !job ||
    job.status !== "open" ||
    (job.published_at && new Date(job.published_at) > now) ||
    (job.closes_at && new Date(job.closes_at) <= now)
  ) {
    return NextResponse.json({ error: "This role is not accepting applications" }, { status: 404 });
  }

  // Check for duplicate application
  const { data: existing } = await supabaseAdmin
    .from("candidates")
    .select("id")
    .eq("job_id", job_id)
    .eq("email", email.toLowerCase())
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "An application with this email already exists for this role" },
      { status: 409 }
    );
  }

  const { data: candidate, error } = await supabaseAdmin
    .from("candidates")
    .insert({
      job_id,
      full_name,
      email: email.toLowerCase(),
      phone: phone || null,
      location: location || null,
      linkedin_url: linkedin_url || null,
      portfolio_url: portfolio_url || null,
      cover_message: cover_message || null,
      source: source || "direct",
      consented_at: new Date().toISOString(),
      applied_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await notifyRoles(
    RECRUITER_ROLES,
    `New application: ${full_name} for ${job.title}`,
    `/hire/candidates/${candidate.id}`
  );

  // The pipeline and hiring dashboard counts now include this applicant.
  await invalidateTables("candidates");

  return NextResponse.json({
    candidateId: candidate.id,
    // The form can upload a CV without exposing a broadly writable public route.
    uploadToken: createCandidateUploadToken(candidate.id, job_id),
  });
}
