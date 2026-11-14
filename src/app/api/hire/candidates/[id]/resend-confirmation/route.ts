import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { assertHireCandidateAccess } from "@/lib/hire-company-access";
import { supabaseAdmin } from "@/lib/supabase";
import { sendApplicationConfirmation } from "@/lib/application-emails";
import { getHireCompanyBrand } from "@/lib/hire-company-brand";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  try {
    await assertHireCandidateAccess({
      candidateId: id,
      userId: session.user.id,
      userRole: session.user.role,
      minimumRole: "recruiter",
    });
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { data: candidate } = await supabaseAdmin
    .from("candidates")
    .select("full_name, email, company_id, jobs(title)")
    .eq("id", id)
    .maybeSingle();
  const candidateWithJob = candidate as unknown as {
    full_name: string;
    email: string;
    company_id: string;
    jobs: { title: string } | null;
  } | null;
  if (!candidateWithJob?.email || !candidateWithJob.jobs?.title)
    return NextResponse.json(
      { error: "Candidate or role not found" },
      { status: 404 },
    );
  const sent = await sendApplicationConfirmation({
    email: candidateWithJob.email,
    fullName: candidateWithJob.full_name,
    jobTitle: candidateWithJob.jobs.title,
    company: await getHireCompanyBrand(candidateWithJob.company_id),
  });
  if (!sent)
    return NextResponse.json(
      { error: "Confirmation could not be sent" },
      { status: 502 },
    );
  return NextResponse.json({ ok: true });
}
