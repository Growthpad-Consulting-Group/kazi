import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import type { Database } from "@/types/database";

const STATUSES = ["draft", "upcoming", "live", "paused", "completed", "archived"] as const;
const AUDIENCES = ["company", "department", "location", "manager_group", "staff"] as const;

function cleanFilters(input: unknown, audience: string): { ok: true; filters: string[] } | { ok: false } {
  const filters = Array.isArray(input) ? [...new Set(input.filter((value): value is string => typeof value === "string" && Boolean(value.trim())))] : [];
  if (audience !== "company" && !filters.length) return { ok: false };
  return { ok: true, filters: audience === "company" ? [] : filters };
}

type Status = typeof STATUSES[number];
type Audience = typeof AUDIENCES[number];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !userCan(session.user, "manage_recognition_campaigns")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await request.json().catch(() => null) as {
    status?: string; name?: string; goal?: string; audience_type?: string; starts_at?: string | null; ends_at?: string | null; value_ids?: string[]; audience_filters?: string[];
  } | null;

  if (body?.name === undefined) {
    if (!body?.status || !STATUSES.includes(body.status as Status)) return NextResponse.json({ error: "Choose a valid campaign state." }, { status: 400 });
    const { error } = await supabaseAdmin.from("recognition_campaigns").update({ status: body.status as Status }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!body.name.trim()) return NextResponse.json({ error: "Campaign name is required." }, { status: 400 });
  if (!body.audience_type || !AUDIENCES.includes(body.audience_type as Audience)) return NextResponse.json({ error: "Choose a valid audience." }, { status: 400 });
  const targets = cleanFilters(body.audience_filters, body.audience_type);
  if (!targets.ok) return NextResponse.json({ error: "Choose at least one audience target." }, { status: 400 });
  if (body.starts_at && body.ends_at && new Date(body.ends_at) < new Date(body.starts_at)) return NextResponse.json({ error: "The end date must be on or after the start date." }, { status: 400 });
  if (body.status !== undefined && !STATUSES.includes(body.status as Status)) return NextResponse.json({ error: "Choose a valid campaign state." }, { status: 400 });

  const update: Database["public"]["Tables"]["recognition_campaigns"]["Update"] = {
    name: body.name.trim(),
    goal: body.goal?.trim() || null,
    audience_type: body.audience_type as Audience,
    audience_filters: targets.filters,
    starts_at: body.starts_at || null,
    ends_at: body.ends_at || null,
    value_ids: body.value_ids ?? [],
  };
  if (body.status !== undefined) update.status = body.status as Status;
  const { error } = await supabaseAdmin.from("recognition_campaigns").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
