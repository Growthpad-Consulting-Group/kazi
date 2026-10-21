import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type QueryResult = { data: unknown; error: { message: string } | null };
type Table = { select: (columns: string) => PromiseLike<QueryResult> };
type Database = { from: (table: string) => Table };
type WriteResult = { data: unknown; error: { message: string } | null };
type WriteDatabase = { from: (table: string) => { insert: (values: Record<string, unknown>) => { select: (columns: string) => { single: () => PromiseLike<WriteResult> } } } };
type Profile = { id: string; user_id: string | null };
type Assignment = { template_id: string };
type Template = { id: string };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const database = supabaseAdmin as unknown as Database;
  const [{ data: templateData, error: templateError }, { data: profileData, error: profileError }, { data: assignmentData, error: assignmentError }] = await Promise.all([
    database.from("signature_templates").select("id, name, description, html, thumbnail_url, is_default, sort_order, created_at, updated_at"),
    database.from("signature_staff_profiles").select("id, user_id"),
    database.from("signature_assignments").select("staff_profile_id, template_id, overrides, deploy_status, deploy_error, gmail_sync_status, gmail_sync_error, last_deployed_at, last_gmail_synced_at, updated_at"),
  ]);
  for (const result of [templateError, profileError, assignmentError]) {
    if (result) return NextResponse.json({ error: result.message }, { status: 500 });
  }

  const canManage = hasRole(session.user.role, "hr");
  const templates = (templateData ?? []) as Template[];
  if (canManage) return NextResponse.json({ templates, canManage: true });

  const profile = ((profileData ?? []) as Profile[]).find((row) => row.user_id === session.user.id);
  const assignment = ((assignmentData ?? []) as Assignment[]).find((row) => (row as Assignment & { staff_profile_id: string }).staff_profile_id === profile?.id) ?? null;
  return NextResponse.json({
    templates: assignment ? templates.filter((template) => template.id === assignment.template_id) : [],
    assignment,
    canManage: false,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { name?: unknown; description?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "A template name is required." }, { status: 400 });
  const description = typeof body.description === "string" ? body.description.trim() || null : null;
  const database = supabaseAdmin as unknown as WriteDatabase;
  const { data, error } = await database.from("signature_templates").insert({ name, description, html: "", blocks: [] }).select("id, name, description, html, blocks, canvas_width").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}
