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
  const { status } = (await req.json()) as { status?: SurveyStatus };
  if (!status || !["draft", "active", "closed"].includes(status))
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
