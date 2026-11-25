import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { notifyCareersSiteJobsChanged } from "@/lib/careers-site";
import { notifyGoogleOfJob } from "@/lib/google-job-indexing";

/** How far back a job's close date is still treated as a fresh closure. */
const LOOKBACK_HOURS = 6;

/**
 * Open jobs close by date, but nothing else changes when that happens, so the
 * careers site would keep showing them until someone edits a job. This run
 * refreshes the careers site when a job has just closed, and asks Google to
 * drop the page once per job. Safe to rerun.
 */
export async function POST(request: Request) {
  if (!hasCronAccess(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3_600_000);
  const { data, error } = await supabaseAdmin
    .from("jobs")
    .select("id, slug, google_removed_at")
    .eq("status", "open")
    .gt("closes_at", since.toISOString())
    .lte("closes_at", now.toISOString());
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const closed = data ?? [];
  if (!closed.length) return NextResponse.json({ ok: true, closed: 0 });

  await notifyCareersSiteJobsChanged();

  let removedFromGoogle = 0;
  for (const job of closed) {
    if (job.google_removed_at) continue;
    if (await notifyGoogleOfJob(job.slug, "URL_DELETED")) {
      await supabaseAdmin
        .from("jobs")
        .update({ google_removed_at: now.toISOString() })
        .eq("id", job.id);
      removedFromGoogle += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    closed: closed.length,
    removedFromGoogle,
  });
}
