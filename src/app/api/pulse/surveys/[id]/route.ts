import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import type { SurveyStatus } from "@/types/database";
import { audienceUserIds } from "@/features/pulse/surveys/audience";
import { notifySurveyPublished } from "@/lib/notifications";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_surveys")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json()) as {
    status?: SurveyStatus;
    title?: unknown;
    description?: unknown;
  };
  const { status } = body;
  if (status === undefined) {
    const { data: draft } = await supabaseAdmin
      .from("surveys")
      .select("status")
      .eq("id", id)
      .maybeSingle();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description =
      typeof body.description === "string" ? body.description.trim() : "";
    if (!draft || draft.status !== "draft")
      return NextResponse.json(
        { error: "Only draft surveys can be edited." },
        { status: 409 },
      );
    if (!title || title.length > 160 || description.length > 1000)
      return NextResponse.json(
        { error: "Provide a valid title and description." },
        { status: 400 },
      );
    const { error } = await supabaseAdmin
      .from("surveys")
      .update({ title, description })
      .eq("id", id);
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 });
    await invalidateTables("surveys");
    return NextResponse.json({ ok: true });
  }
  if (!["draft", "active", "closed", "archived"].includes(status))
    return NextResponse.json(
      { error: "Choose a valid survey status." },
      { status: 400 },
    );

  const { data: existing } = await supabaseAdmin
    .from("surveys")
    .select("id,title,status,opens_at,closes_at")
    .eq("id", id)
    .maybeSingle();
  if (!existing)
    return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  const now = new Date();
  if (
    status === "active" &&
    existing.opens_at &&
    new Date(existing.opens_at) > now
  )
    return NextResponse.json(
      { error: "This survey is scheduled to open later." },
      { status: 400 },
    );

  const { error } = await supabaseAdmin
    .from("surveys")
    .update({ status: status as SurveyStatus })
    .eq("id", id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (status === "active" && existing.status !== "active") {
    for (const userId of await audienceUserIds(id))
      await notifySurveyPublished(userId, existing.title, id);
  }
  await invalidateTables("surveys");
  return NextResponse.json({ ok: true });
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_surveys"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const { data: source } = await supabaseAdmin
    .from("surveys")
    .select("title,description,questions,anonymous")
    .eq("id", id)
    .maybeSingle();
  if (!source)
    return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  const { data: copy, error } = await supabaseAdmin
    .from("surveys")
    .insert({
      title: `${source.title} (copy)`,
      description: source.description,
      questions: source.questions,
      anonymous: source.anonymous,
      status: "draft",
      created_by: session.user.id,
    })
    .select("id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("surveys");
  return NextResponse.json(copy, { status: 201 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_surveys"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const [{ data: survey }, { count }] = await Promise.all([
    supabaseAdmin.from("surveys").select("status").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("survey_responses")
      .select("id", { count: "exact", head: true })
      .eq("survey_id", id),
  ]);
  if (!survey)
    return NextResponse.json({ error: "Survey not found." }, { status: 404 });
  if (survey.status !== "draft" || (count ?? 0) > 0)
    return NextResponse.json(
      { error: "Only unused draft surveys can be deleted." },
      { status: 409 },
    );
  const { error } = await supabaseAdmin.from("surveys").delete().eq("id", id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  await invalidateTables("surveys");
  return NextResponse.json({ ok: true });
}
