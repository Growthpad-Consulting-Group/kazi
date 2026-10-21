import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import TemplatesClient from "./TemplatesClient";

type QueryResult = { data: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => PromiseLike<QueryResult> } };

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) redirect("/signatures");
  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database.from("signature_templates").select("id, name, description, html, thumbnail_url, is_default, created_at, updated_at");
  if (error) throw new Error(error.message);
  return <TemplatesClient templates={(data ?? []) as never[]} />;
}
