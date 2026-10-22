import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

type RouteContext = { params: Promise<{ id: string }> };
type Result = { data: unknown; error: { message: string } | null };
type SignatureDatabase = { from: (table: string) => { select: (columns: string) => PromiseLike<Result>; insert: (values: Record<string, unknown>) => PromiseLike<Result> & { select: (columns: string) => { single: () => PromiseLike<Result> } } } };

export async function POST(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_hiring")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const password = typeof body.password === "string" ? body.password : "";
  const managerId = typeof body.managerId === "string" && body.managerId ? body.managerId : null;
  const startDate = typeof body.startDate === "string" && body.startDate ? body.startDate : null;
  if (password.length < 8) return NextResponse.json({ error: "Set a temporary password of at least 8 characters." }, { status: 400 });

  const { data: candidateData, error: candidateError } = await supabaseAdmin.from("candidates").select("id, full_name, email, phone, location, stage, job_id, hired_user_id").eq("id", id).maybeSingle();
  if (candidateError || !candidateData) return NextResponse.json({ error: candidateError?.message ?? "Candidate not found." }, { status: 404 });
  if (candidateData.stage !== "hired") return NextResponse.json({ error: "Move the candidate to Hired before creating a staff account." }, { status: 400 });
  if (candidateData.hired_user_id) return NextResponse.json({ error: "This candidate has already been onboarded.", userId: candidateData.hired_user_id }, { status: 409 });

  const { data: jobData, error: jobError } = await supabaseAdmin.from("jobs").select("title, department, location").eq("id", candidateData.job_id).maybeSingle();
  if (jobError) return NextResponse.json({ error: jobError.message }, { status: 500 });
  const { data: existingUser } = await supabaseAdmin.from("users").select("id").eq("email", candidateData.email.toLowerCase()).maybeSingle();
  if (existingUser) return NextResponse.json({ error: "A Kazi staff account already uses this email.", userId: existingUser.id }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);
  const { data: user, error: userError } = await supabaseAdmin.from("users").insert({ name: candidateData.full_name, email: candidateData.email.toLowerCase(), password_hash: passwordHash, role: "employee", department: jobData?.department ?? null, job_title: jobData?.title ?? null, location: jobData?.location ?? candidateData.location ?? null, manager_id: managerId, start_date: startDate, is_active: true }).select("id, name").single();
  if (userError) return NextResponse.json({ error: userError.message }, { status: 500 });

  const { error: candidateUpdateError } = await supabaseAdmin.from("candidates").update({ hired_user_id: user.id }).eq("id", id);
  if (candidateUpdateError) return NextResponse.json({ error: `Staff account created, but candidate handoff could not be recorded: ${candidateUpdateError.message}` }, { status: 500 });

  const signatureDatabase = supabaseAdmin as unknown as SignatureDatabase;
  const { data: domains } = await signatureDatabase.from("signature_domains").select("id, name");
  const emailDomain = candidateData.email.split("@")[1]?.toLowerCase();
  const domain = ((domains ?? []) as { id: string; name: string }[]).find((item) => item.name.toLowerCase() === emailDomain);
  let signatureProfileId: string | null = null;
  if (domain) {
    const { data: defaultTemplates } = await signatureDatabase.from("signature_templates").select("id, is_default");
    const { data: profileData, error: profileError } = await signatureDatabase.from("signature_staff_profiles").insert({ user_id: user.id, domain_id: domain.id, email: candidateData.email.toLowerCase(), full_name: candidateData.full_name, role_title: jobData?.title ?? null, department: jobData?.department ?? null, phone: candidateData.phone, status: "active" }).select("id").single();
    if (profileError) return NextResponse.json({ error: `Staff account created, but signature identity could not be created: ${profileError.message}` }, { status: 500 });
    signatureProfileId = (profileData as { id?: string } | null)?.id ?? null;
    const defaultTemplate = ((defaultTemplates ?? []) as { id: string; is_default: boolean }[]).find((template) => template.is_default);
    if (signatureProfileId && defaultTemplate) await signatureDatabase.from("signature_assignments").insert({ staff_profile_id: signatureProfileId, template_id: defaultTemplate.id, deploy_status: "pending", gmail_sync_status: "pending" });
  }
  await Promise.all([invalidateTables("users"), invalidateTables("candidates")]);
  return NextResponse.json({ person: user, signatureProfileId }, { status: 201 });
}
