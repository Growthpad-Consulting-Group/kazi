import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { syncStaffSignature } from "@/features/signatures/lib/syncStaffSignature";
import { MAX_AUTOMATIC_SYNC_ATTEMPTS } from "@/features/signatures/lib/syncLimits";
import { hasCronAccess } from "@/lib/cron-auth";

// Called on a schedule by GitHub Actions (.github/workflows/signature-retry.yml).
// Re-sends signatures whose last Gmail sync failed, a few mailboxes per run, so one
// outage doesn't turn into a burst of requests. A mailbox is retried until it has failed
// MAX_AUTOMATIC_SYNC_ATTEMPTS times in a row; after that only an admin's manual sync retries it.
// Secured with CRON_SECRET.

const BATCH_SIZE = 20;

type Result = { data?: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        lt: (
          column: string,
          value: number,
        ) => { limit: (count: number) => PromiseLike<Result> };
      };
    };
  };
};

export async function GET(request: Request) {
  if (!hasCronAccess(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_assignments")
    .select("staff_profile_id")
    .eq("gmail_sync_status", "error")
    .lt("gmail_sync_attempts", MAX_AUTOMATIC_SYNC_ATTEMPTS)
    .limit(BATCH_SIZE);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const profileIds = ((data ?? []) as { staff_profile_id: string }[]).map(
    (row) => row.staff_profile_id,
  );
  let synced = 0;
  let failed = 0;
  for (const staffProfileId of profileIds) {
    const result = await syncStaffSignature(staffProfileId);
    if (result.status === "synced") synced += 1;
    if (result.status === "error") failed += 1;
  }

  return NextResponse.json({
    ok: true,
    attempted: profileIds.length,
    synced,
    failed,
  });
}
