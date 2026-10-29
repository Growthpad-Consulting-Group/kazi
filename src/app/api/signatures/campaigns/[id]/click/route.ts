import { NextResponse } from "next/server";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };
type Result = { data?: unknown; error: { message: string } | null };
type SelectQuery = PromiseLike<Result> & {
  eq: (
    column: string,
    value: string,
  ) => { maybeSingle: () => PromiseLike<Result> } & PromiseLike<Result>;
};
type Database = {
  from: (table: string) => {
    select: (columns: string) => SelectQuery;
    insert: (values: Record<string, unknown>) => PromiseLike<Result>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<Result>;
    };
  };
};

export async function GET(request: Request, { params }: Context) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id))
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const database = supabaseAdmin as unknown as Database;
  const { data, error } = await database
    .from("signature_campaigns")
    .select("link_url")
    .eq("id", id)
    .maybeSingle();
  if (error || !data)
    return NextResponse.json({ error: "Campaign not found." }, { status: 404 });
  const campaign = data as { link_url: string };
  try {
    new URL(campaign.link_url);
  } catch {
    return NextResponse.json(
      { error: "Campaign destination is invalid." },
      { status: 422 },
    );
  }
  const staffProfileId = new URL(request.url).searchParams.get("staff");
  const date = new Date().toISOString().slice(0, 10);
  after(async () => {
    if (staffProfileId && /^[0-9a-f-]{36}$/i.test(staffProfileId))
      await database
        .from("signature_campaign_clicks")
        .insert({ campaign_id: id, staff_profile_id: staffProfileId });
    const stats = await database
      .from("signature_campaign_daily_stats")
      .select("id, date, clicks")
      .eq("campaign_id", id);
    const row = Array.isArray(stats.data)
      ? (stats.data.find(
          (item: unknown) => (item as { date?: string }).date === date,
        ) as { id: string; clicks: number } | undefined)
      : undefined;
    if (row)
      await database
        .from("signature_campaign_daily_stats")
        .update({ clicks: Number(row.clicks) + 1 })
        .eq("id", row.id);
    else
      await database
        .from("signature_campaign_daily_stats")
        .insert({ campaign_id: id, date, clicks: 1 });
  });
  return NextResponse.redirect(campaign.link_url, { status: 302 });
}
