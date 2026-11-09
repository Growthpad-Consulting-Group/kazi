import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  DAILY_LOG_CATEGORIES,
  type DailyLogCategory,
} from "@/features/pulse/daily-log/constants";

type RoutineInput = {
  id?: unknown;
  title?: unknown;
  client?: unknown;
  category?: unknown;
  minutes?: unknown;
  cadence?: unknown;
  weekdays?: unknown;
  endsOn?: unknown;
  isActive?: unknown;
};

const CADENCES = ["daily", "weekdays", "weekly", "custom"] as const;
type Cadence = (typeof CADENCES)[number];

function validate(input: RoutineInput) {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const client =
    typeof input.client === "string" ? input.client.trim().slice(0, 100) : "";
  const category = input.category as DailyLogCategory;
  const minutes = Number(input.minutes);
  const cadence = input.cadence as Cadence;
  const weekdays = Array.isArray(input.weekdays)
    ? [
        ...new Set(
          input.weekdays
            .map(Number)
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
        ),
      ].sort()
    : [];
  const endsOn =
    typeof input.endsOn === "string" && input.endsOn ? input.endsOn : null;
  if (!title || title.length > 200)
    return { error: "Give this routine a title up to 200 characters." };
  if (!DAILY_LOG_CATEGORIES.includes(category))
    return { error: "Choose a valid category." };
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)
    return { error: "Duration must be between 1 minute and 24 hours." };
  if (!CADENCES.includes(cadence)) return { error: "Choose a valid cadence." };
  if ((cadence === "weekly" || cadence === "custom") && !weekdays.length)
    return { error: "Choose at least one day." };
  if (cadence === "weekly" && weekdays.length !== 1)
    return { error: "Choose one day for a weekly routine." };
  if (endsOn && !/^\d{4}-\d{2}-\d{2}$/.test(endsOn))
    return { error: "Choose a valid end date." };
  return {
    value: {
      title,
      client: client || null,
      category,
      minutes,
      cadence,
      weekdays,
      ends_on: endsOn,
    },
  };
}

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  return { userId: session.user.id };
}

export async function GET() {
  const user = await currentUser();
  if (user.error) return user.error;
  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- migration has not regenerated Supabase types
    .from("recurring_work_templates")
    .select(
      "id, title, client, category, minutes, cadence, weekdays, ends_on, is_active",
    )
    .eq("user_id", user.userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    routines: (data ?? []).map((routine: Record<string, unknown>) => ({
      ...routine,
      endsOn: routine.ends_on ?? null,
      isActive: routine.is_active !== false,
    })),
  });
}

function normalize(value: string | null) {
  return (value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

async function duplicateRoutine(
  userId: string,
  value: {
    title: string;
    client: string | null;
    category: DailyLogCategory;
    cadence: Cadence;
    weekdays: number[];
  },
  excludeId?: string,
) {
  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- recurring-work controls are newer than generated Supabase types
    .from("recurring_work_templates")
    .select("id, title, client, category, cadence, weekdays")
    .eq("user_id", userId);
  if (error) return { error: error.message };
  const duplicate = (data ?? []).find(
    (routine: Record<string, unknown>) =>
      routine.id !== excludeId &&
      normalize(String(routine.title ?? "")) === normalize(value.title) &&
      normalize(typeof routine.client === "string" ? routine.client : null) ===
        normalize(value.client) &&
      routine.category === value.category &&
      routine.cadence === value.cadence &&
      JSON.stringify(routine.weekdays ?? []) === JSON.stringify(value.weekdays),
  );
  return { duplicate };
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (user.error) return user.error;
  const result = validate((await req.json().catch(() => null)) ?? {});
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const existing = await duplicateRoutine(user.userId, result.value);
  if (existing.error)
    return NextResponse.json({ error: existing.error }, { status: 500 });
  if (existing.duplicate)
    return NextResponse.json(
      { error: "This routine already exists. Edit the existing one instead." },
      { status: 409 },
    );
  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- migration has not regenerated Supabase types
    .from("recurring_work_templates")
    .insert({ user_id: user.userId, ...result.value })
    .select(
      "id, title, client, category, minutes, cadence, weekdays, ends_on, is_active",
    )
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    {
      routine: {
        ...data,
        endsOn: data.ends_on ?? null,
        isActive: data.is_active !== false,
      },
    },
    { status: 201 },
  );
}

export async function PATCH(req: Request) {
  const user = await currentUser();
  if (user.error) return user.error;
  const input = (await req.json().catch(() => null)) as RoutineInput | null;
  if (!input || typeof input.id !== "string")
    return NextResponse.json(
      { error: "A routine is required." },
      { status: 400 },
    );
  if (typeof input.isActive === "boolean") {
    const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- recurring-work controls are newer than generated Supabase types
      .from("recurring_work_templates")
      .update({
        is_active: input.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("user_id", user.userId)
      .select(
        "id, title, client, category, minutes, cadence, weekdays, ends_on, is_active",
      )
      .maybeSingle();
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data)
      return NextResponse.json(
        { error: "Routine not found." },
        { status: 404 },
      );
    return NextResponse.json({
      routine: {
        ...data,
        endsOn: data.ends_on ?? null,
        isActive: data.is_active !== false,
      },
    });
  }
  const result = validate(input);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const existing = await duplicateRoutine(user.userId, result.value, input.id);
  if (existing.error)
    return NextResponse.json({ error: existing.error }, { status: 500 });
  if (existing.duplicate)
    return NextResponse.json(
      { error: "This routine already exists. Edit the existing one instead." },
      { status: 409 },
    );
  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- migration has not regenerated Supabase types
    .from("recurring_work_templates")
    .update({ ...result.value, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", user.userId)
    .select(
      "id, title, client, category, minutes, cadence, weekdays, ends_on, is_active",
    )
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  return NextResponse.json({
    routine: {
      ...data,
      endsOn: data.ends_on ?? null,
      isActive: data.is_active !== false,
    },
  });
}

export async function DELETE(req: Request) {
  const user = await currentUser();
  if (user.error) return user.error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id)
    return NextResponse.json(
      { error: "A routine is required." },
      { status: 400 },
    );
  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- migration has not regenerated Supabase types
    .from("recurring_work_templates")
    .delete()
    .eq("id", id)
    .eq("user_id", user.userId)
    .select("id")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
