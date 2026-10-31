import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import type { ReviewCycle } from "@/types/database";
import { invalidateTables } from "@/lib/cache/invalidate";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_reviews")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    title,
    cycle,
    start_date,
    end_date,
    self_review_due_date,
    manager_review_due_date,
    peer_review_due_date,
    min_peer_reviews,
    max_peer_reviews,
    peer_feedback_anonymous,
    competency_template_id,
  } = await req.json();
  if (
    typeof title !== "string" ||
    !title.trim() ||
    title.trim().length > 140 ||
    !["quarterly", "biannual", "annual"].includes(cycle) ||
    typeof start_date !== "string" ||
    typeof end_date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(start_date) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(end_date) ||
    end_date < start_date ||
    [self_review_due_date, manager_review_due_date, peer_review_due_date].some(
      (date) =>
        date && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)),
    ) ||
    (self_review_due_date &&
      (self_review_due_date < start_date || self_review_due_date > end_date)) ||
    (manager_review_due_date &&
      (!self_review_due_date ||
        manager_review_due_date < self_review_due_date ||
        manager_review_due_date > end_date)) ||
    (peer_review_due_date &&
      (!manager_review_due_date ||
        peer_review_due_date < manager_review_due_date ||
        peer_review_due_date > end_date)) ||
    !Number.isInteger(min_peer_reviews) ||
    !Number.isInteger(max_peer_reviews) ||
    min_peer_reviews < 0 ||
    max_peer_reviews < 1 ||
    min_peer_reviews > max_peer_reviews ||
    max_peer_reviews > 10
  ) {
    return NextResponse.json(
      { error: "Choose a title, cycle frequency, and valid review period." },
      { status: 400 },
    );
  }

  let competencyTemplate: unknown = null;
  let competencyTemplateId: string | null = null;
  if (competency_template_id) {
    if (typeof competency_template_id !== "string")
      return NextResponse.json(
        { error: "Choose a valid competency template." },
        { status: 400 },
      );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed templates
    const { data: template } = await (supabaseAdmin as any)
      .from("review_competency_templates")
      .select("id, criteria")
      .eq("id", competency_template_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!template)
      return NextResponse.json(
        { error: "The selected competency template is unavailable." },
        { status: 400 },
      );
    competencyTemplateId = template.id;
    competencyTemplate = template.criteria;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed deadline fields
  const { data, error } = await (supabaseAdmin as any)
    .from("review_cycles")
    .insert({
      title: title.trim(),
      cycle: cycle as ReviewCycle,
      start_date,
      end_date,
      created_by: session.user.id,
      self_review_due_date: self_review_due_date || null,
      manager_review_due_date: manager_review_due_date || null,
      peer_review_due_date: peer_review_due_date || null,
      min_peer_reviews,
      max_peer_reviews,
      peer_feedback_anonymous: peer_feedback_anonymous === true,
      competency_template_id: competencyTemplateId,
      competency_template: competencyTemplate,
    })
    .select("id")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed audit table
  await (supabaseAdmin as any).from("performance_review_audit_logs").insert({
    cycle_id: (data as unknown as { id: string }).id,
    actor_id: session.user.id,
    action: "cycle_created",
  });
  await invalidateTables("review_cycles");
  return NextResponse.json({ id: (data as unknown as { id: string }).id });
}
