import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase";

const DEFAULT_RETENTION_DAYS = 90;
const BATCH_SIZE = 500;

function retentionDays() {
  const configured = Number(
    process.env.AI_LOG_RETENTION_DAYS ?? DEFAULT_RETENTION_DAYS,
  );
  return Number.isInteger(configured) && configured >= 30 && configured <= 3650
    ? configured
    : DEFAULT_RETENTION_DAYS;
}

/** Scheduled privacy housekeeping. Use `?dryRun=1` to verify a batch first. */
export async function GET(request: Request) {
  if (!hasCronAccess(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const days = retentionDays();
  const cutoff = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000,
  ).toISOString();
  const { data, error } = await supabaseAdmin
    .from("ai_logs")
    .select("id")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((row) => row.id);
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "1";
  if (dryRun || ids.length === 0) {
    return NextResponse.json({
      dryRun,
      retentionDays: days,
      cutoff,
      eligible: ids.length,
      deleted: 0,
    });
  }

  const { error: deleteError } = await supabaseAdmin
    .from("ai_logs")
    .delete()
    .in("id", ids);
  if (deleteError)
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  return NextResponse.json({
    dryRun: false,
    retentionDays: days,
    cutoff,
    eligible: ids.length,
    deleted: ids.length,
  });
}
