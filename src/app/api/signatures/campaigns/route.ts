import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type Result = { data?: unknown; error: { message: string } | null };
type Database = {
  from: (table: string) => {
    insert: (values: Record<string, unknown> | Record<string, unknown>[]) => {
      select: (columns: string) => { single: () => PromiseLike<Result> };
    } & PromiseLike<Result>;
  };
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = (await request.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const imageUrl =
    typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : "";
  if (!name || !imageUrl || !linkUrl)
    return NextResponse.json(
      { error: "Name, banner image, and destination URL are required." },
      { status: 400 },
    );
  try {
    new URL(imageUrl);
    new URL(linkUrl);
  } catch {
    return NextResponse.json(
      { error: "Use valid image and destination URLs." },
      { status: 400 },
    );
  }
  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_campaigns")
    .insert({
      name,
      image_url: imageUrl,
      link_url: linkUrl,
      variant_label:
        typeof body.variantLabel === "string"
          ? body.variantLabel.trim() || null
          : null,
      domain_id:
        typeof body.domainId === "string" &&
        /^[0-9a-f-]{36}$/i.test(body.domainId)
          ? body.domainId
          : null,
      weight:
        typeof body.weight === "number" && Number.isFinite(body.weight)
          ? Math.max(1, Math.min(100, Math.round(body.weight)))
          : 1,
      active: body.active !== false,
      starts_at:
        typeof body.startsAt === "string" && body.startsAt
          ? body.startsAt
          : null,
      ends_at:
        typeof body.endsAt === "string" && body.endsAt ? body.endsAt : null,
    })
    .select("id")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  const audienceType = body.audienceType;
  const audienceIds = Array.isArray(body.audienceIds)
    ? body.audienceIds.filter(
        (value): value is string =>
          typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value),
      )
    : [];
  const departments = Array.isArray(body.audienceDepartments)
    ? body.audienceDepartments
        .filter(
          (value): value is string =>
            typeof value === "string" && Boolean(value.trim()),
        )
        .map((value) => value.trim())
    : typeof body.audienceDepartment === "string" &&
        body.audienceDepartment.trim()
      ? [body.audienceDepartment.trim()]
      : [];
  const campaignId = (data as { id: string }).id;
  const audiences =
    audienceType === "staff"
      ? audienceIds.map((staff_profile_id) => ({
          campaign_id: campaignId,
          audience_type: "staff",
          staff_profile_id,
        }))
      : audienceType === "staff_group"
        ? audienceIds.map((staff_group_id) => ({
            campaign_id: campaignId,
            audience_type: "staff_group",
            staff_group_id,
          }))
        : audienceType === "department"
          ? departments.map((department) => ({
              campaign_id: campaignId,
              audience_type: "department",
              department,
            }))
          : [];
  if (audiences.length) {
    const audienceResult = await database
      .from("signature_campaign_audiences")
      .insert(audiences);
    if (audienceResult.error)
      return NextResponse.json(
        { error: audienceResult.error.message },
        { status: 500 },
      );
  }
  return NextResponse.json({ campaign: data }, { status: 201 });
}
