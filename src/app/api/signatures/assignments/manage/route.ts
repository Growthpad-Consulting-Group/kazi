import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type UpsertResult = { error: { message: string } | null };
type Database = { from: (table: string) => { upsert: (values: Record<string, unknown>, options: { onConflict: string }) => PromiseLike<UpsertResult> } };

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const staffProfileId = typeof body.staffProfileId === "string" ? body.staffProfileId : "";
  const templateId = typeof body.templateId === "string" ? body.templateId : "";
  if (!/^[0-9a-f-]{36}$/i.test(staffProfileId) || !/^[0-9a-f-]{36}$/i.test(templateId)) return NextResponse.json({ error: "A staff profile and template are required." }, { status: 400 });

  const database = supabaseAdmin as unknown as Database;
  const { error } = await database.from("signature_assignments").upsert({
    staff_profile_id: staffProfileId,
    template_id: templateId,
    overrides: typeof body.overrides === "object" && body.overrides ? body.overrides : {},
    deploy_status: "pending",
    gmail_sync_status: "pending",
  }, { onConflict: "staff_profile_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
