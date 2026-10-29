import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, RECRUITMENT_ROLES } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type SearchResult = {
  id: string;
  label: string;
  detail: string;
  href: string;
  kind: "staff" | "candidate" | "job" | "goal" | "review" | "signature";
};
type PersonRow = {
  id: string;
  name: string;
  email: string;
  job_title: string | null;
  department: string | null;
};
type JobRow = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
};
type CandidateRow = {
  id: string;
  full_name: string;
  email: string;
  stage: string;
};
type SignatureRow = {
  id: string;
  full_name: string;
  email: string;
  role_title: string | null;
};
type GoalRow = { id: string; title: string; status: string };
type ReviewCycleRow = {
  id: string;
  title: string;
  cycle: string;
  status: string;
};

function queryTerm(value: string) {
  // Supabase's `or` syntax treats punctuation as operators. Keeping searches
  // to ordinary words also makes this endpoint predictable for every client.
  return value
    .trim()
    .replace(/[,.()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const term = queryTerm(new URL(request.url).searchParams.get("q") ?? "");
  if (term.length < 2)
    return NextResponse.json({ results: [] satisfies SearchResult[] });

  const pattern = `%${term}%`;
  const canSearchStaff = can(session.user.role, "view_people");
  const canSearchHiring = RECRUITMENT_ROLES.includes(session.user.role);
  const canManageSignatures = can(session.user.role, "manage_signatures");

  const peopleQuery = canSearchStaff
    ? supabaseAdmin
        .from("users")
        .select("id, name, email, job_title, department")
        .or(`name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(6)
    : supabaseAdmin
        .from("users")
        .select("id, name, email, job_title, department")
        .eq("id", session.user.id)
        .or(`name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(1);
  const jobsQuery = canSearchHiring
    ? supabaseAdmin
        .from("jobs")
        .select("id, title, department, location")
        .or(`title.ilike.${pattern},department.ilike.${pattern}`)
        .limit(5)
    : Promise.resolve({ data: [], error: null });
  const candidatesQuery = canSearchHiring
    ? supabaseAdmin
        .from("candidates")
        .select("id, full_name, email, stage")
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(6)
    : Promise.resolve({ data: [], error: null });
  const signaturesQuery = canManageSignatures
    ? supabaseAdmin
        .from("signature_staff_profiles")
        .select("id, full_name, email, role_title")
        .or(`full_name.ilike.${pattern},email.ilike.${pattern}`)
        .limit(5)
    : Promise.resolve({ data: [], error: null });
  const goalsQuery = canSearchStaff
    ? supabaseAdmin
        .from("goals")
        .select("id, title, status")
        .ilike("title", pattern)
        .limit(5)
    : supabaseAdmin
        .from("goals")
        .select("id, title, status")
        .eq("owner_id", session.user.id)
        .ilike("title", pattern)
        .limit(5);
  const reviewsQuery = canSearchStaff
    ? supabaseAdmin
        .from("review_cycles")
        .select("id, title, cycle, status")
        .ilike("title", pattern)
        .limit(5)
    : Promise.resolve({ data: [], error: null });

  const [
    peopleResult,
    jobsResult,
    candidatesResult,
    signaturesResult,
    goalsResult,
    reviewsResult,
  ] = await Promise.all([
    peopleQuery,
    jobsQuery,
    candidatesQuery,
    signaturesQuery,
    goalsQuery,
    reviewsQuery,
  ]);
  const failures = [
    peopleResult,
    jobsResult,
    candidatesResult,
    signaturesResult,
    goalsResult,
    reviewsResult,
  ].find((result) => result.error);
  if (failures?.error)
    return NextResponse.json(
      { error: failures.error.message },
      { status: 500 },
    );

  const results: SearchResult[] = [
    ...((peopleResult.data ?? []) as unknown as PersonRow[]).map((person) => ({
      id: person.id,
      label: person.name,
      detail: [person.job_title, person.department, person.email]
        .filter(Boolean)
        .join(" · "),
      href: `/staff/${person.id}`,
      kind: "staff" as const,
    })),
    ...((jobsResult.data ?? []) as unknown as JobRow[]).map((job) => ({
      id: job.id,
      label: job.title,
      detail:
        [job.department, job.location].filter(Boolean).join(" · ") || "Job",
      href: `/hire/jobs/${job.id}`,
      kind: "job" as const,
    })),
    ...((candidatesResult.data ?? []) as unknown as CandidateRow[]).map(
      (candidate) => ({
        id: candidate.id,
        label: candidate.full_name,
        detail: `Candidate · ${candidate.stage}`,
        href: `/hire/candidates/${candidate.id}`,
        kind: "candidate" as const,
      }),
    ),
    ...((goalsResult.data ?? []) as unknown as GoalRow[]).map((goal) => ({
      id: goal.id,
      label: goal.title,
      detail: `Goal · ${goal.status.replaceAll("_", " ")}`,
      href: "/pulse/goals",
      kind: "goal" as const,
    })),
    ...((reviewsResult.data ?? []) as unknown as ReviewCycleRow[]).map(
      (review) => ({
        id: review.id,
        label: review.title,
        detail: `${review.cycle} review · ${review.status.replaceAll("_", " ")}`,
        href: `/pulse/reviews/${review.id}`,
        kind: "review" as const,
      }),
    ),
    ...((signaturesResult.data ?? []) as unknown as SignatureRow[]).map(
      (profile) => ({
        id: profile.id,
        label: profile.full_name,
        detail: [profile.role_title, profile.email].filter(Boolean).join(" · "),
        href: `/signatures/staff/${profile.id}`,
        kind: "signature" as const,
      }),
    ),
  ];

  return NextResponse.json({ results });
}
