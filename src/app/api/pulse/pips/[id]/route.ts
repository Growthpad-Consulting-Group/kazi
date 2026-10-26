import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import type { Database, Pip } from "@/types/database";
import { invalidateTables } from "@/lib/cache/invalidate";

type RouteContext = { params: Promise<{ id: string }> };
type Action = { text: string; due_date: string | null; done: boolean };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const OUTCOMES = ["successful", "unsuccessful"] as const;

async function loadPip(id: string) {
  const { data } = await supabaseAdmin.from("pips").select("*").eq("id", id).maybeSingle();
  return data as unknown as Pip | null;
}

function isEditor(pip: Pip, userId: string, role: Parameters<typeof can>[0]) {
  return pip.manager_id === userId || pip.hr_id === userId || can(role, "manage_pips");
}

function isParticipant(pip: Pip, userId: string, role: Parameters<typeof can>[0]) {
  return pip.user_id === userId || isEditor(pip, userId, role);
}

export async function PATCH(req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const pip = await loadPip(id);
  if (!pip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const editor = isEditor(pip, session.user.id, session.user.role);
  if (!isParticipant(pip, session.user.id, session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const update: Database["public"]["Tables"]["pips"]["Update"] = {};

  if (body.actions !== undefined) {
    if (!Array.isArray(body.actions)) return NextResponse.json({ error: "Actions must be a list." }, { status: 400 });
    if (!editor) {
      // The employee can only tick steps off, not add or remove them.
      const current = (pip.actions ?? []) as Action[];
      const incoming = body.actions as Action[];
      if (incoming.length !== current.length) return NextResponse.json({ error: "Only your manager can change the action steps." }, { status: 403 });
      update.actions = current.map((action, index) => ({ ...action, done: Boolean(incoming[index]?.done) }));
    } else {
      update.actions = body.actions as Action[];
    }
  }

  if (!editor) {
    if (Object.keys(update).length === 0 && Object.keys(body).some((key) => key !== "actions")) {
      return NextResponse.json({ error: "Only your manager can change this plan." }, { status: 403 });
    }
  } else {
    const textFields = ["concern", "expected_outcomes", "support_provided", "check_in_frequency"] as const;
    for (const key of textFields) {
      if (body[key] === undefined) continue;
      const value = typeof body[key] === "string" ? (body[key] as string).trim() : "";
      if ((key === "concern" || key === "expected_outcomes") && !value) return NextResponse.json({ error: "Concern and expected outcomes are required." }, { status: 400 });
      if (key === "concern") update.concern = value;
      else if (key === "expected_outcomes") update.expected_outcomes = value;
      else update[key] = value || null;
    }
    for (const key of ["start_date", "review_date"] as const) {
      if (body[key] === undefined) continue;
      const value = typeof body[key] === "string" && body[key] ? (body[key] as string) : null;
      if (key === "start_date" && !value) return NextResponse.json({ error: "A start date is required." }, { status: 400 });
      if (value && !DATE.test(value)) return NextResponse.json({ error: "Dates must be valid." }, { status: 400 });
      if (key === "start_date") update.start_date = value as string;
      else update.review_date = value;
    }
    const start = (update.start_date ?? pip.start_date) as string;
    const review = (update.review_date ?? pip.review_date) as string | null;
    if (review && review < start) return NextResponse.json({ error: "The review date must be on or after the start date." }, { status: 400 });

    if (body.resolve !== undefined) {
      const resolve = body.resolve as { outcome?: unknown; notes?: unknown } | null;
      if (!resolve || !OUTCOMES.includes(resolve.outcome as (typeof OUTCOMES)[number])) {
        return NextResponse.json({ error: "Choose whether the plan was successful or unsuccessful." }, { status: 400 });
      }
      update.resolved_at = new Date().toISOString();
      update.outcome = resolve.outcome as (typeof OUTCOMES)[number];
      update.resolution_notes = typeof resolve.notes === "string" && resolve.notes.trim() ? resolve.notes.trim() : null;
    }
    if (body.reopen === true) {
      update.resolved_at = null;
      update.outcome = null;
      update.resolution_notes = null;
    }
  }

  if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const { data, error } = await supabaseAdmin.from("pips").update(update).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("pips");
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const pip = await loadPip(id);
  if (!pip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isEditor(pip, session.user.id, session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabaseAdmin.from("pips").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("pips");
  return NextResponse.json({ ok: true });
}
