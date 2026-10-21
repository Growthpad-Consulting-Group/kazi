import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import StaffAssignmentsClient from "./StaffAssignmentsClient";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";

type QueryResult = { data: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => PromiseLike<QueryResult> } };

export default async function StaffAssignmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "hr")) redirect("/signatures");
  const database = supabaseAdmin as unknown as Database;
  const [staff, templates, assignments] = await Promise.all([
    database.from("signature_staff_profiles").select("id, email, full_name, role_title, department, photo_url, status"),
    database.from("signature_templates").select("id, name, is_default"),
    database.from("signature_assignments").select("staff_profile_id, template_id, deploy_status, gmail_sync_status, last_gmail_synced_at"),
  ]);
  for (const result of [staff, templates, assignments]) if (result.error) throw new Error(result.error.message);
  return <StaffAssignmentsClient staff={(staff.data ?? []) as never[]} templates={(templates.data ?? []) as never[]} assignments={(assignments.data ?? []) as never[]} />;
}
