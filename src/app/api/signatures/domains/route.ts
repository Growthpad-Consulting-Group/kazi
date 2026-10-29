import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type QueryResult = { data: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    select: (columns: string) => PromiseLike<QueryResult>;
    insert: (values: Record<string, unknown>) => {
      select: (columns: string) => PromiseLike<QueryResult>;
    };
  };
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(session.user.role, "manage_signatures"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_domains")
    .select(
      "id, name, platform, gateway_status, spf_verified, dkim_verified, notes, created_at, updated_at",
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ domains: data ?? [] });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name)
    return NextResponse.json(
      { error: "Domain name is required." },
      { status: 400 },
    );

  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_domains")
    .insert({
      name,
      platform: body.platform ?? "google_workspace",
      gateway_status: "not_configured",
      spf_verified: false,
      dkim_verified: false,
      notes: null,
    })
    .select(
      "id, name, platform, gateway_status, spf_verified, dkim_verified, notes",
    );
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ domain: (data as unknown[])[0] }, { status: 201 });
}
