import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type QueryResult = { data: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => PromiseLike<QueryResult> } };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRole(session.user.role, "hr")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_domains")
    .select("id, name, platform, gateway_status, spf_verified, dkim_verified, notes, created_at, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ domains: data ?? [] });
}
