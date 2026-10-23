import { after, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };
type Result = { data?: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<Result> } }; insert: (values: Record<string, unknown>) => PromiseLike<Result> } };

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  const url = new URL(request.url);
  const destination = url.searchParams.get("to");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !destination) return NextResponse.json({ error: "Link not found." }, { status: 404 });
  try { new URL(destination); } catch { return NextResponse.json({ error: "Invalid destination." }, { status: 422 }); }
  const database = supabaseAdmin as unknown as Database;
  const template = await database.from("signature_templates").select("id").eq("id", id).maybeSingle();
  if (template.error || !template.data) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  const staffProfileId = url.searchParams.get("staff");
  const label = url.searchParams.get("label");
  after(async () => { await database.from("signature_template_link_clicks").insert({ template_id: id, staff_profile_id: staffProfileId && /^[0-9a-f-]{36}$/i.test(staffProfileId) ? staffProfileId : null, destination, label: label || null }); });
  return NextResponse.redirect(destination, { status: 302 });
}
