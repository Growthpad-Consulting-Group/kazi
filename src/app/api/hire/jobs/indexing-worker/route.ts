import { NextResponse } from "next/server";
import { notifyCareersSiteJobsChanged } from "@/lib/careers-site";
import { hasCronAccess } from "@/lib/cron-auth";
import { notifyGoogleOfJob } from "@/lib/google-job-indexing";
import { supabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

/** Notifies Google about jobs that became public or expired on a schedule. */
export async function POST(request: Request) {
  if (!hasCronAccess(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date().toISOString();
  const { data: jobsToPublish, error: publishQueryError } = await supabaseAdmin
    .from("jobs")
    .select("id, slug")
    .eq("status", "open")
    .or(`published_at.is.null,published_at.lte.${now}`)
    .or("closes_at.is.null,closes_at.gt." + now)
    .is("google_indexed_at", null)
    .limit(100);
  if (publishQueryError) throw new Error(publishQueryError.message);

  const { data: jobsToRemove, error: removeQueryError } = await supabaseAdmin
    .from("jobs")
    .select("id, slug")
    .not("google_indexed_at", "is", null)
    .is("google_removed_at", null)
    .or(`status.neq.open,closes_at.lte.${now}`)
    .limit(100);
  if (removeQueryError) throw new Error(removeQueryError.message);

  // Clear the careers site's cached job data before asking Google to crawl it.
  if ((jobsToPublish?.length ?? 0) > 0 || (jobsToRemove?.length ?? 0) > 0)
    await notifyCareersSiteJobsChanged();

  let updated = 0;
  let removed = 0;
  for (const job of jobsToPublish ?? []) {
    if (await notifyGoogleOfJob(job.slug, "URL_UPDATED")) {
      await supabaseAdmin
        .from("jobs")
        .update({
          google_indexed_at: new Date().toISOString(),
          google_removed_at: null,
        })
        .eq("id", job.id);
      updated++;
    }
  }
  for (const job of jobsToRemove ?? []) {
    if (await notifyGoogleOfJob(job.slug, "URL_DELETED")) {
      await supabaseAdmin
        .from("jobs")
        .update({ google_removed_at: new Date().toISOString() })
        .eq("id", job.id);
      removed++;
    }
  }

  return NextResponse.json({ updated, removed });
}
