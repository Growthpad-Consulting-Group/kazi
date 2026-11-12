import { NextResponse } from "next/server";
import {
  extensionCors,
  extensionTokenUser,
} from "@/lib/browser-extension-auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  isEditableLogDate,
  isValidLogDate,
  type DailyLogEntry,
} from "@/features/pulse/daily-log/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- extension tables are newer than generated types.
const db = supabaseAdmin as any;

export async function OPTIONS(request: Request) {
  return extensionCors(request, new NextResponse(null, { status: 204 }));
}

/** The day's logged tasks for the extension's list, with their row index. */
export async function GET(request: Request) {
  const token = await extensionTokenUser(request);
  if (!token)
    return extensionCors(
      request,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  const date = new URL(request.url).searchParams.get("date");
  if (!isValidLogDate(date))
    return extensionCors(
      request,
      NextResponse.json({ error: "A valid date is required" }, { status: 400 }),
    );
  const { data, error } = await db
    .from("daily_activity_logs")
    .select("entries")
    .eq("user_id", token.user_id)
    .eq("log_date", date)
    .maybeSingle();
  if (error)
    return extensionCors(
      request,
      NextResponse.json(
        { error: "Could not load today's log" },
        { status: 500 },
      ),
    );
  const entries = ((data?.entries ?? []) as DailyLogEntry[]).map(
    (entry, index) => ({
      index,
      task: entry.task,
      client: entry.client ?? null,
      category: entry.category,
      minutes: entry.minutes,
      mergeable: !entry.startTime && !entry.endTime && !entry.claimOutsideHours,
    }),
  );
  return extensionCors(
    request,
    NextResponse.json({ entries, editable: isEditableLogDate(date) }),
  );
}

/** Removes one task row from a day's log. Only days still open for editing. */
export async function DELETE(request: Request) {
  const token = await extensionTokenUser(request);
  if (!token)
    return extensionCors(
      request,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  const body = (await request.json().catch(() => null)) as {
    date?: unknown;
    index?: unknown;
    task?: unknown;
  } | null;
  if (
    !isValidLogDate(body?.date) ||
    !Number.isInteger(body?.index) ||
    (body?.index as number) < 0
  )
    return extensionCors(
      request,
      NextResponse.json(
        { error: "A date and row are required" },
        { status: 400 },
      ),
    );
  if (!isEditableLogDate(body.date))
    return extensionCors(
      request,
      NextResponse.json(
        { error: "This day is locked and can no longer be changed." },
        { status: 403 },
      ),
    );
  const { data, error } = await db
    .from("daily_activity_logs")
    .select("entries")
    .eq("user_id", token.user_id)
    .eq("log_date", body.date)
    .maybeSingle();
  if (error)
    return extensionCors(
      request,
      NextResponse.json(
        { error: "Could not load today's log" },
        { status: 500 },
      ),
    );
  const entries = (data?.entries ?? []) as DailyLogEntry[];
  const target = entries[body.index as number];
  if (!target)
    return extensionCors(
      request,
      NextResponse.json(
        { error: "That row no longer exists" },
        { status: 404 },
      ),
    );
  // The list can be stale; only delete the row the staff member saw.
  if (
    typeof body?.task !== "string" ||
    target.task.trim().toLowerCase() !== body.task.trim().toLowerCase()
  )
    return extensionCors(
      request,
      NextResponse.json(
        { error: "The log changed. Refresh the list and try again." },
        { status: 409 },
      ),
    );
  const remaining = entries.filter((_, index) => index !== body.index);
  const { error: saveError } = await db
    .from("daily_activity_logs")
    .upsert(
      { user_id: token.user_id, log_date: body.date, entries: remaining },
      { onConflict: "user_id,log_date" },
    );
  if (saveError)
    return extensionCors(
      request,
      NextResponse.json(
        { error: "Could not update today's log" },
        { status: 500 },
      ),
    );
  return extensionCors(request, NextResponse.json({ ok: true }));
}
