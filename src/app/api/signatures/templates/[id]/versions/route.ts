import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
type Context = { params: Promise<{ id: string }> };
type Result = { data: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    select: (fields: string) => {
      eq: (
        key: string,
        value: string,
      ) => {
        order: (
          key: string,
          options: { ascending: boolean },
        ) => PromiseLike<Result>;
      };
    };
  };
};
export async function GET(_request: Request, { params }: Context) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const db = supabaseAdmin as unknown as Database;
  const { data, error } = await db
    .from("signature_template_versions")
    .select("id,name,html,blocks,builder_data,canvas_width,created_at")
    .eq("template_id", id)
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}
