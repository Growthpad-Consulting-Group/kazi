import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };
type Result = { error: { message: string } | null };
type Database = { from: (table: string) => { update: (values: Record<string, unknown>) => { eq: (key: string, value: string) => PromiseLike<Result> }; delete: () => { eq: (key: string, value: string) => PromiseLike<Result> } } };

export async function PATCH(request: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid domain." }, { status: 400 });
  const body = await request.json() as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const key of ["platform", "gateway_status", "notes"] as const) if (typeof body[key] === "string") values[key] = body[key].trim() || null;
  for (const key of ["spf_verified", "dkim_verified"] as const) if (typeof body[key] === "boolean") values[key] = body[key];
  if (!Object.keys(values).length) return NextResponse.json({ error: "No changes supplied." }, { status: 400 });
  const database = supabaseAdmin as unknown as Database;
  const { error } = await database.from("signature_domains").update(values).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid domain." }, { status: 400 });
  const database = supabaseAdmin as unknown as Database;
  const { error } = await database.from("signature_domains").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
