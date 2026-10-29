import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { syncStaffSignature } from "@/features/signatures/lib/syncStaffSignature";

type RouteContext = { params: Promise<{ id: string }> };
type Result = { data?: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => PromiseLike<Result>;
    };
  };
};

/** Re-sends a template to the Gmail of everyone it is assigned to. */
export async function POST(_request: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Invalid template." }, { status: 400 });

  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_assignments")
    .select("staff_profile_id")
    .eq("template_id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const profileIds = ((data ?? []) as { staff_profile_id: string }[]).map(
    (row) => row.staff_profile_id,
  );
  let synced = 0;
  const failures: { staffProfileId: string; message: string }[] = [];
  // One mailbox at a time, so a failure for one person doesn't stop the others.
  for (const staffProfileId of profileIds) {
    const result = await syncStaffSignature(staffProfileId);
    if (result.status === "synced") synced += 1;
    if (result.status === "error")
      failures.push({ staffProfileId, message: result.message });
  }

  return NextResponse.json({
    ok: true,
    total: profileIds.length,
    synced,
    failed: failures.length,
    failures,
  });
}
