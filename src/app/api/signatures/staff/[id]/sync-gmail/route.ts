import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { pushSignatureToGmail } from "@/features/signatures/lib/gmailSync";
import { appendCampaignBanner } from "@/features/signatures/lib/campaignRenderer";

type RouteContext = { params: Promise<{ id: string }> };
type Result = { data?: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<Result> } }; update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<Result> } } };

function render(html: string, profile: Record<string, unknown>) {
  return html.replace(/{{\s*([a-z_]+)\s*}}/gi, (_match, key: string) => String(profile[key] ?? ""));
}

export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const database = supabaseAdmin as unknown as Database;
  const { data: profileData, error: profileError } = await database.from("signature_staff_profiles").select("id, email, full_name, role_title, department, phone, mobile, photo_url").eq("id", id).maybeSingle();
  if (profileError || !profileData) return NextResponse.json({ error: profileError?.message ?? "Staff profile not found." }, { status: 404 });
  const { data: assignmentData, error: assignmentError } = await database.from("signature_assignments").select("template_id").eq("staff_profile_id", id).maybeSingle();
  if (assignmentError || !assignmentData) return NextResponse.json({ error: assignmentError?.message ?? "No signature is assigned." }, { status: 400 });
  const assignment = assignmentData as { template_id: string };
  const { data: templateData, error: templateError } = await database.from("signature_templates").select("html").eq("id", assignment.template_id).maybeSingle();
  if (templateError || !templateData) return NextResponse.json({ error: templateError?.message ?? "Template not found." }, { status: 404 });
  try {
    const profile = profileData as Record<string, unknown>;
    const signature = await appendCampaignBanner(render(String((templateData as { html: string }).html), profile), String(profile.email), String(profile.id), typeof profile.department === "string" ? profile.department : null, true);
    await pushSignatureToGmail(String(profile.email), signature);
    const { error } = await database.from("signature_assignments").update({ gmail_sync_status: "synced", gmail_sync_error: null, last_gmail_synced_at: new Date().toISOString() }).eq("staff_profile_id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Gmail sync failed.";
    await database.from("signature_assignments").update({ gmail_sync_status: "error", gmail_sync_error: message }).eq("staff_profile_id", id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
