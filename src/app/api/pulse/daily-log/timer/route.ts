import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  extensionCors,
  extensionTokenUser,
} from "@/lib/browser-extension-auth";
import type { SharedActiveTimer } from "@/features/pulse/daily-log/shared-timer";

const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- migration is newer than generated types.

async function timerOwner(request: Request) {
  const session = await getServerSession(authOptions);
  if (session) return { userId: session.user.id, extension: false };
  const extension = await extensionTokenUser(request);
  return extension ? { userId: extension.user_id, extension: true } : null;
}

function reply(request: Request, extension: boolean, response: NextResponse) {
  return extension ? extensionCors(request, response) : response;
}

export async function OPTIONS(request: Request) {
  return extensionCors(request, new NextResponse(null, { status: 204 }));
}

export async function GET(request: Request) {
  const owner = await timerOwner(request);
  if (!owner)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await db
    .from("shared_active_timers")
    .select("log_date, timer")
    .eq("user_id", owner.userId)
    .maybeSingle();
  if (error)
    return reply(
      request,
      owner.extension,
      NextResponse.json({ error: "Could not load timer" }, { status: 500 }),
    );
  return reply(
    request,
    owner.extension,
    NextResponse.json({
      timer: data ? { ...data.timer, date: data.log_date } : null,
    }),
  );
}

export async function PUT(request: Request) {
  const owner = await timerOwner(request);
  if (!owner)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    timer?: unknown;
    date?: unknown;
  } | null;
  if (!body?.timer || typeof body.date !== "string")
    return reply(
      request,
      owner.extension,
      NextResponse.json(
        { error: "A timer and log date are required" },
        { status: 400 },
      ),
    );
  const { error } = await db.from("shared_active_timers").upsert(
    {
      user_id: owner.userId,
      log_date: body.date,
      timer: body.timer,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error)
    return reply(
      request,
      owner.extension,
      NextResponse.json({ error: "Could not save timer" }, { status: 500 }),
    );
  return reply(request, owner.extension, NextResponse.json({ ok: true }));
}

export async function DELETE(request: Request) {
  const owner = await timerOwner(request);
  if (!owner)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await db
    .from("shared_active_timers")
    .delete()
    .eq("user_id", owner.userId);
  if (error)
    return reply(
      request,
      owner.extension,
      NextResponse.json({ error: "Could not stop timer" }, { status: 500 }),
    );
  return reply(request, owner.extension, NextResponse.json({ ok: true }));
}

export async function POST(request: Request) {
  const owner = await timerOwner(request);
  if (!owner)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    action?: "pause" | "resume";
    timer?: SharedActiveTimer;
  } | null;
  if (!body?.timer || !["pause", "resume"].includes(body.action ?? ""))
    return reply(
      request,
      owner.extension,
      NextResponse.json(
        { error: "A valid timer action is required" },
        { status: 400 },
      ),
    );
  const updatedAt = new Date().toISOString();
  const timer: SharedActiveTimer = {
    ...body.timer,
    running: body.action === "resume",
    startedAt: body.action === "resume" ? updatedAt : null,
    updatedAt,
  };
  const { error } = await db
    .from("shared_active_timers")
    .upsert(
      {
        user_id: owner.userId,
        log_date: timer.logDate,
        timer,
        updated_at: updatedAt,
      },
      { onConflict: "user_id" },
    );
  if (error)
    return reply(
      request,
      owner.extension,
      NextResponse.json({ error: "Could not update timer" }, { status: 500 }),
    );
  return reply(request, owner.extension, NextResponse.json({ timer }));
}
