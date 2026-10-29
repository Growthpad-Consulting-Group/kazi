import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type QueryResult = { data: unknown; error: { message: string } | null };
type Table = { select: (columns: string) => PromiseLike<QueryResult> };
type Database = { from: (table: string) => Table };
type Profile = { id: string; user_id: string | null };
type Assignment = { staff_profile_id: string };

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const database = supabaseAdmin as unknown as Database;
  const [
    { data: assignmentData, error: assignmentError },
    { data: profileData, error: profileError },
  ] = await Promise.all([
    database
      .from("signature_assignments")
      .select(
        "id, staff_profile_id, template_id, overrides, deploy_status, deploy_error, gmail_sync_status, gmail_sync_error, last_deployed_at, last_gmail_synced_at, created_at, updated_at",
      ),
    database.from("signature_staff_profiles").select("id, user_id"),
  ]);
  if (assignmentError)
    return NextResponse.json(
      { error: assignmentError.message },
      { status: 500 },
    );
  if (profileError)
    return NextResponse.json({ error: profileError.message }, { status: 500 });

  const canManage = can(session.user.role, "manage_signatures");
  const assignments = (assignmentData ?? []) as Assignment[];
  if (canManage) return NextResponse.json({ assignments, canManage: true });
  const profile = ((profileData ?? []) as Profile[]).find(
    (row) => row.user_id === session.user.id,
  );
  return NextResponse.json({
    assignments: assignments.filter(
      (assignment) => assignment.staff_profile_id === profile?.id,
    ),
    canManage: false,
  });
}
