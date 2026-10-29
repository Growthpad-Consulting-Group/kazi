import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type QueryResult = {
  data: unknown;
  count: number | null;
  error: { message: string } | null;
};
type Database = {
  from: (table: string) => {
    select: (
      columns: string,
      options?: { count: "exact"; head?: boolean },
    ) => PromiseLike<QueryResult>;
  };
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const database = supabaseAdmin as unknown as Database;
  const canManage = can(session.user.role, "manage_signatures");
  if (!canManage) {
    const { data, error } = await database
      .from("signature_staff_profiles")
      .select(
        "id, email, full_name, role_title, department, photo_url, status, user_id",
      );
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    const profile =
      ((data ?? []) as { user_id: string | null }[]).find(
        (row) => row.user_id === session.user.id,
      ) ?? null;
    return NextResponse.json({ profile, canManage: false });
  }

  const [staff, templates, domains, assignments] = await Promise.all([
    database
      .from("signature_staff_profiles")
      .select("id", { count: "exact", head: true }),
    database
      .from("signature_templates")
      .select("id", { count: "exact", head: true }),
    database
      .from("signature_domains")
      .select(
        "id, name, platform, gateway_status, spf_verified, dkim_verified",
      ),
    database
      .from("signature_assignments")
      .select("deploy_status, gmail_sync_status"),
  ]);
  for (const result of [staff, templates, domains, assignments]) {
    if (result.error)
      return NextResponse.json(
        { error: result.error.message },
        { status: 500 },
      );
  }
  const assignmentRows = (assignments.data ?? []) as {
    deploy_status: string;
    gmail_sync_status: string;
  }[];
  return NextResponse.json({
    canManage: true,
    staffCount: staff.count ?? 0,
    templateCount: templates.count ?? 0,
    domains: domains.data ?? [],
    deployedCount: assignmentRows.filter(
      (row) => row.deploy_status === "deployed",
    ).length,
    attentionCount: assignmentRows.filter(
      (row) =>
        row.deploy_status === "error" || row.gmail_sync_status === "error",
    ).length,
  });
}
