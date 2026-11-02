import { NextResponse } from "next/server";
import {
  extensionCors,
  extensionTokenUser,
} from "@/lib/browser-extension-auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  isEditableLogDate,
  isValidLogDate,
  validateDailyLogEntries,
} from "@/features/pulse/daily-log/constants";

export async function OPTIONS(request: Request) {
  return extensionCors(request, new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  const token = await extensionTokenUser(request);
  if (!token)
    return extensionCors(
      request,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    date?: unknown;
    entry?: unknown;
  } | null;
  if (
    typeof body?.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      body.id,
    ) ||
    !isValidLogDate(body.date) ||
    !isEditableLogDate(body.date)
  ) {
    return extensionCors(
      request,
      NextResponse.json({ error: "Invalid timer entry" }, { status: 400 }),
    );
  }
  const validated = validateDailyLogEntries([body.entry]);
  if (!validated.ok)
    return extensionCors(
      request,
      NextResponse.json({ error: validated.error }, { status: 400 }),
    );

  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- extension sync migration is newer than generated types.
  const { error: claimError } = await db
    .from("browser_extension_timer_entries")
    .insert({
      user_id: token.user_id,
      client_entry_id: body.id,
      log_date: body.date,
    });
  if (claimError?.code === "23505")
    return extensionCors(
      request,
      NextResponse.json({ ok: true, duplicate: true }),
    );
  if (claimError)
    return extensionCors(
      request,
      NextResponse.json(
        { error: "Could not save timer entry" },
        { status: 500 },
      ),
    );

  const releaseClaim = () =>
    db
      .from("browser_extension_timer_entries")
      .delete()
      .eq("user_id", token.user_id)
      .eq("client_entry_id", body.id);

  const { data: existing, error: readError } = await db
    .from("daily_activity_logs")
    .select("entries")
    .eq("user_id", token.user_id)
    .eq("log_date", body.date)
    .maybeSingle();
  if (readError) {
    await releaseClaim();
    return extensionCors(
      request,
      NextResponse.json({ error: "Could not load daily log" }, { status: 500 }),
    );
  }
  const entries = [
    ...((existing?.entries ?? []) as unknown[]),
    ...validated.entries,
  ];
  const allValidated = validateDailyLogEntries(entries);
  if (!allValidated.ok) {
    await releaseClaim();
    return extensionCors(
      request,
      NextResponse.json({ error: allValidated.error }, { status: 400 }),
    );
  }
  const { error: saveError } = await db
    .from("daily_activity_logs")
    .upsert(
      {
        user_id: token.user_id,
        log_date: body.date,
        entries: allValidated.entries,
      },
      { onConflict: "user_id,log_date" },
    );
  if (saveError) {
    await releaseClaim();
    return extensionCors(
      request,
      NextResponse.json({ error: "Could not save daily log" }, { status: 500 }),
    );
  }
  return extensionCors(request, NextResponse.json({ ok: true }));
}

export async function DELETE(request: Request) {
  const token = await extensionTokenUser(request);
  if (!token)
    return extensionCors(
      request,
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- extension sync migration is newer than generated types.
  await db
    .from("browser_extension_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", token.id);
  return extensionCors(request, NextResponse.json({ ok: true }));
}
