import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type QueryResult = { data: unknown; error: { message: string } | null };
type Table = { select: (columns: string) => PromiseLike<QueryResult> };
type Database = { from: (table: string) => Table };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_staff_profiles")
    .select("id, user_id, domain_id, email, full_name, role_title, department, phone, mobile, photo_url, status, created_at, updated_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as { user_id: string | null }[];
  const canManage = hasRole(session.user.role, "hr");
  return NextResponse.json({
    staff: canManage ? rows : rows.filter((row) => row.user_id === session.user.id),
    canManage,
  });
}
