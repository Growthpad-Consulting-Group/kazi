import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };
type Result = { error: { message: string } | null };
type Database = { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<Result> }; delete: () => { eq: (column: string, value: string) => PromiseLike<Result> }; insert: (values: Record<string, unknown>[]) => PromiseLike<Result> } };

function validUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;
  try { new URL(value); return true; } catch { return false; }
}

export async function PATCH(request: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  const body = await request.json() as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) values.name = body.name.trim();
  if (body.imageUrl !== undefined) { if (!validUrl(body.imageUrl)) return NextResponse.json({ error: "Use a valid banner image URL." }, { status: 400 }); values.image_url = String(body.imageUrl).trim(); }
  if (body.linkUrl !== undefined) { if (!validUrl(body.linkUrl)) return NextResponse.json({ error: "Use a valid destination URL." }, { status: 400 }); values.link_url = String(body.linkUrl).trim(); }
  if (typeof body.variantLabel === "string") values.variant_label = body.variantLabel.trim() || null;
  if (typeof body.domainId === "string" || body.domainId === null) values.domain_id = body.domainId || null;
  if (typeof body.active === "boolean") values.active = body.active;
  if (typeof body.weight === "number" && Number.isFinite(body.weight)) values.weight = Math.max(1, Math.min(100, Math.round(body.weight)));
  for (const [requestKey, dbKey] of [["startsAt", "starts_at"], ["endsAt", "ends_at"]] as const) if (typeof body[requestKey] === "string" || body[requestKey] === null) values[dbKey] = body[requestKey] || null;
  if (!Object.keys(values).length && !("audienceType" in body)) return NextResponse.json({ error: "No campaign changes supplied." }, { status: 400 });
  const database = supabaseAdmin as unknown as Database;
  if (Object.keys(values).length) {
    const { error } = await database.from("signature_campaigns").update(values).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if ("audienceType" in body) {
    const audienceType = body.audienceType;
    const audienceIds = Array.isArray(body.audienceIds) ? body.audienceIds.filter((value): value is string => typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value)) : [];
    const departments = Array.isArray(body.audienceDepartments) ? body.audienceDepartments.filter((value): value is string => typeof value === "string" && Boolean(value.trim())).map((value) => value.trim()) : typeof body.audienceDepartment === "string" && body.audienceDepartment.trim() ? [body.audienceDepartment.trim()] : [];
    if (audienceType !== "all" && audienceType !== "staff" && audienceType !== "staff_group" && audienceType !== "department") return NextResponse.json({ error: "Invalid campaign audience." }, { status: 400 });
    if ((audienceType === "staff" || audienceType === "staff_group") && !audienceIds.length) return NextResponse.json({ error: "Choose at least one audience." }, { status: 400 });
    if (audienceType === "department" && !departments.length) return NextResponse.json({ error: "Choose at least one department." }, { status: 400 });
    const deletion = await database.from("signature_campaign_audiences").delete().eq("campaign_id", id);
    if (deletion.error) return NextResponse.json({ error: deletion.error.message }, { status: 500 });
    const audiences = audienceType === "staff" ? audienceIds.map((staff_profile_id) => ({ campaign_id: id, audience_type: "staff", staff_profile_id })) : audienceType === "staff_group" ? audienceIds.map((staff_group_id) => ({ campaign_id: id, audience_type: "staff_group", staff_group_id })) : audienceType === "department" ? departments.map((department) => ({ campaign_id: id, audience_type: "department", department })) : [];
    if (audiences.length) { const insertion = await database.from("signature_campaign_audiences").insert(audiences); if (insertion.error) return NextResponse.json({ error: insertion.error.message }, { status: 500 }); }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid campaign." }, { status: 400 });
  const database = supabaseAdmin as unknown as Database;
  const { error } = await database.from("signature_campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
