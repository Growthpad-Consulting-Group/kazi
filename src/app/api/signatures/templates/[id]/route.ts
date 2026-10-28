import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { sanitizeSignatureHtml } from "@/features/signatures/lib/sanitizeSignatureHtml";

type RouteContext = { params: Promise<{ id: string }> };
type Result = { data?: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (fields: string) => { eq: (column: string, value: string) => ({ maybeSingle: () => PromiseLike<Result> } & PromiseLike<Result>) }; insert: (values: Record<string, unknown>) => PromiseLike<Result>; update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<Result> }; delete: () => { eq: (column: string, value: string) => PromiseLike<Result> } } };

export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid template." }, { status: 400 });
  const body = await request.json() as Record<string, unknown>;
  const database = supabaseAdmin as unknown as Database;
  const { data: current, error: currentError } = await database.from("signature_templates").select("id, name, html, blocks, builder_data, canvas_width").eq("id", id).maybeSingle();
  if (currentError) return NextResponse.json({ error: currentError.message }, { status: 500 });
  if (!current) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  const old = current as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) values.name = body.name.trim();
  if (typeof body.description === "string") values.description = body.description.trim() || null;
  if (typeof body.html === "string") values.html = sanitizeSignatureHtml(body.html);
  if (Array.isArray(body.blocks)) values.blocks = body.blocks;
  if (typeof body.canvasWidth === "number" && Number.isFinite(body.canvasWidth)) values.canvas_width = Math.max(320, Math.min(800, Math.round(body.canvasWidth)));
  if (body.isDefault === true) values.is_default = true;
  if (!Object.keys(values).length) return NextResponse.json({ error: "No template changes supplied." }, { status: 400 });
  if (values.html !== undefined || values.name !== undefined) {
    const { error } = await database.from("signature_template_versions").insert({ template_id: id, name: old.name, html: old.html, blocks: old.blocks ?? null, builder_data: old.builder_data ?? null, canvas_width: old.canvas_width ?? null });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (values.is_default) {
    const { error } = await database.from("signature_templates").update({ is_default: false }).eq("is_default", "true");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const { error } = await database.from("signature_templates").update(values).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid template." }, { status: 400 });
  const database = supabaseAdmin as unknown as Database;
  const { data: template, error: templateError } = await database.from("signature_templates").select("id, is_default").eq("id", id).maybeSingle();
  if (templateError) return NextResponse.json({ error: templateError.message }, { status: 500 });
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  if ((template as { is_default?: boolean }).is_default) return NextResponse.json({ error: "Choose another default template before deleting this one." }, { status: 409 });
  const { data: assignments, error: assignmentError } = await database.from("signature_assignments").select("id").eq("template_id", id);
  if (assignmentError) return NextResponse.json({ error: assignmentError.message }, { status: 500 });
  const assignedCount = Array.isArray(assignments) ? assignments.length : 0;
  if (assignedCount) return NextResponse.json({ error: "Reassign " + assignedCount + " staff profile" + (assignedCount === 1 ? "" : "s") + " before deleting this template." }, { status: 409 });
  const { error: deleteError } = await database.from("signature_templates").delete().eq("id", id);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
