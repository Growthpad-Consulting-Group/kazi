import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

const audiences = new Set([
  "company",
  "department",
  "location",
  "manager_group",
  "staff",
]);

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_side_quests"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const brief = typeof body?.brief === "string" ? body.brief.trim() : "";
  const completionCriteria =
    typeof body?.completion_criteria === "string"
      ? body.completion_criteria.trim()
      : "";
  if (!title || !brief || !completionCriteria)
    return NextResponse.json(
      { error: "Title, brief and completion criteria are required." },
      { status: 400 },
    );

  const audienceType = body?.audience_type;
  if (typeof audienceType !== "string" || !audiences.has(audienceType))
    return NextResponse.json(
      { error: "Choose a valid eligible audience." },
      { status: 400 },
    );
  const filters = Array.isArray(body?.audience_filters)
    ? [
        ...new Set(
          (body.audience_filters as unknown[]).filter(
            (value): value is string =>
              typeof value === "string" && Boolean(value.trim()),
          ),
        ),
      ]
    : [];
  if (audienceType !== "company" && !filters.length)
    return NextResponse.json(
      { error: "Choose at least one eligible audience target." },
      { status: 400 },
    );

  const points = body?.points === undefined ? 10 : Number(body.points);
  if (!Number.isInteger(points) || points < 0 || points > 1000)
    return NextResponse.json(
      { error: "Points must be a whole number between 0 and 1000." },
      { status: 400 },
    );

  const startsAt =
    typeof body?.starts_at === "string" && body.starts_at
      ? body.starts_at
      : null;
  const endsAt =
    typeof body?.ends_at === "string" && body.ends_at ? body.ends_at : null;
  if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt))
    return NextResponse.json(
      { error: "The end time must be after the start time." },
      { status: 400 },
    );

  const { data: existing } = await supabaseAdmin
    .from("side_quests")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!existing)
    return NextResponse.json(
      { error: "Side Quest not found." },
      { status: 404 },
    );
  const current = (existing as { status: string }).status;
  const status =
    current === "closed" || current === "archived"
      ? current
      : startsAt && new Date(startsAt) > new Date()
        ? "upcoming"
        : "live";

  const { error } = await supabaseAdmin
    .from("side_quests")
    .update({
      title,
      brief,
      completion_criteria: completionCriteria,
      points,
      audience_type: audienceType as
        "company" | "department" | "location" | "manager_group" | "staff",
      audience_filters: filters,
      starts_at: startsAt,
      ends_at: endsAt,
      status: status as "draft" | "upcoming" | "live" | "closed" | "archived",
    })
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_side_quests"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await context.params;

  const { data: awards } = await supabaseAdmin
    .from("reward_ledger")
    .select("id, user_id, amount")
    .eq("reference_type", "side_quest_completion")
    .eq("reference_id", id);
  for (const award of (awards ?? []) as {
    id: string;
    user_id: string;
    amount: number;
  }[]) {
    const { data: wallet } = await supabaseAdmin
      .from("reward_wallets")
      .select("balance")
      .eq("user_id", award.user_id)
      .maybeSingle();
    const balance = (wallet as { balance: number } | null)?.balance ?? 0;
    await supabaseAdmin
      .from("reward_wallets")
      .update({ balance: Math.max(balance - award.amount, 0) })
      .eq("user_id", award.user_id);
  }
  await supabaseAdmin
    .from("reward_ledger")
    .delete()
    .eq("reference_type", "side_quest_completion")
    .eq("reference_id", id);

  const { error } = await supabaseAdmin
    .from("side_quests")
    .delete()
    .eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
