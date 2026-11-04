import { NextResponse } from "next/server";
import { hasCronAccess } from "@/lib/cron-auth";
import { runSlackDigests } from "@/lib/slack-digest-worker";

// Scheduled by GitHub Actions hourly. Safe to rerun: every message is keyed.
export async function POST(request: Request) {
  if (!hasCronAccess(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const counts = await runSlackDigests(new Date());
    // Counts only. Message content is never logged or returned.
    console.info("[slack-digests]", JSON.stringify(counts));
    return NextResponse.json({ ok: true, counts });
  } catch (error) {
    console.error(
      "[slack-digests] run failed",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { ok: false, error: "Slack digests could not run." },
      { status: 500 },
    );
  }
}
