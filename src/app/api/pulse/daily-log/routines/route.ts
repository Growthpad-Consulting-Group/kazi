import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
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
  return {
    value: {
      title,
      client: client || null,
      category,
      minutes,
      cadence,
      weekdays,
    },
  };
}

async function currentUser() {
  const session = await getServerSession(authOptions);
  if (!session)
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  if (can(session.user.role, "manage_checkins")) {
    return {
      error: NextResponse.json(
        {
          error: "Daily routines are available to staff who submit daily logs.",
        },
        { status: 403 },
      ),
    };
  }
  return { userId: session.user.id };
}

export async function GET() {
  const user = await currentUser();
  if (user.error) return user.error;
  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- migration has not regenerated Supabase types
    .from("recurring_work_templates")
    .select("id, title, client, category, minutes, cadence, weekdays")
    .eq("user_id", user.userId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routines: data ?? [] });
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (user.error) return user.error;
  const result = validate((await req.json().catch(() => null)) ?? {});
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- migration has not regenerated Supabase types
    .from("recurring_work_templates")
    .insert({ user_id: user.userId, ...result.value })
    .select("id, title, client, category, minutes, cadence, weekdays")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ routine: data }, { status: 201 });
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
  const result = validate(input);
  if ("error" in result) return NextResponse.json(result, { status: 400 });
  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- migration has not regenerated Supabase types
    .from("recurring_work_templates")
    .update({ ...result.value, updated_at: new Date().toISOString() })
    .eq("id", input.id)
    .eq("user_id", user.userId)
    .select("id, title, client, category, minutes, cadence, weekdays")
    .maybeSingle();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Routine not found." }, { status: 404 });
  return NextResponse.json({ routine: data });
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
  const { error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any -- migration has not regenerated Supabase types
    .from("recurring_work_templates")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.userId);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
