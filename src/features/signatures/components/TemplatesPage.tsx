import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import TemplatesClient from "./TemplatesClient";

type QueryResult = { data: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => PromiseLike<QueryResult> } };
type Assignment = { template_id: string };

export default async function TemplatesPage() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) redirect("/signatures");
  const database = supabaseAdmin as unknown as Database;
  const [templateResult, clickResult, assignmentResult] = await Promise.all([
    database.from("signature_templates").select("id, name, description, html, thumbnail_url, is_default, created_at, updated_at"),
    database.from("signature_template_link_clicks").select("template_id"),
    database.from("signature_assignments").select("template_id"),
  ]);
  if (templateResult.error) throw new Error(templateResult.error.message);
  if (clickResult.error) throw new Error(clickResult.error.message);
  if (assignmentResult.error) throw new Error(assignmentResult.error.message);
  const clickCounts = new Map<string, number>();
  for (const click of (clickResult.data ?? []) as Array<{ template_id: string }>) clickCounts.set(click.template_id, (clickCounts.get(click.template_id) ?? 0) + 1);
  const assignmentCounts = new Map<string, number>();
  for (const assignment of (assignmentResult.data ?? []) as Assignment[]) assignmentCounts.set(assignment.template_id, (assignmentCounts.get(assignment.template_id) ?? 0) + 1);
  const templates = ((templateResult.data ?? []) as Array<Record<string, unknown>>).map((template) => ({
    ...template,
    link_clicks: clickCounts.get(String(template.id)) ?? 0,
    assignment_count: assignmentCounts.get(String(template.id)) ?? 0,
  }));
  return <TemplatesClient templates={templates as never[]} />;
}
