import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

type Campaign = {
  id: string;
  name: string;
  image_url: string;
  link_url: string;
  domain_id: string | null;
  weight: number;
  starts_at: string | null;
  ends_at: string | null;
};
type Audience = {
  campaign_id: string;
  audience_type: "staff" | "staff_group" | "department";
  staff_profile_id: string | null;
  staff_group_id: string | null;
  department: string | null;
};
type StaffGroup = { id: string; member_ids: string[] };

type QueryResult = { data: unknown; error: { message: string } | null };
type SelectQuery = PromiseLike<QueryResult> & {
  eq: (column: string, value: unknown) => PromiseLike<QueryResult>;
};
type CampaignDatabase = {
  from: (
    table:
      | "signature_campaigns"
      | "signature_campaign_daily_stats"
      | "signature_domains"
      | "signature_campaign_audiences"
      | "staff_groups",
  ) => {
    select: (columns: string) => SelectQuery;
    insert: (values: Record<string, unknown>) => PromiseLike<QueryResult>;
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => PromiseLike<QueryResult>;
    };
  };
};

function eligibleCampaigns(
  campaigns: Campaign[],
  email: string,
  domainNames: Map<string, string>,
  audiences: Audience[],
  groups: Map<string, string[]>,
  staffProfileId?: string,
  department?: string | null,
) {
  const now = Date.now();
  const domain = email.split("@")[1]?.toLowerCase();
  return campaigns.filter((campaign) => {
    const hasStarted =
      !campaign.starts_at || new Date(campaign.starts_at).getTime() <= now;
    const hasEnded =
      campaign.ends_at && new Date(campaign.ends_at).getTime() < now;
    const campaignAudiences = audiences.filter(
      (audience) => audience.campaign_id === campaign.id,
    );
    const targetMatches =
      !campaignAudiences.length ||
      campaignAudiences.some((audience) =>
        audience.audience_type === "staff"
          ? audience.staff_profile_id === staffProfileId
          : audience.audience_type === "staff_group"
            ? Boolean(
                staffProfileId &&
                audience.staff_group_id &&
                groups.get(audience.staff_group_id)?.includes(staffProfileId),
              )
            : audience.department?.toLowerCase() === department?.toLowerCase(),
      );
    return (
      hasStarted &&
      !hasEnded &&
      targetMatches &&
      (!campaign.domain_id || domainNames.get(campaign.domain_id) === domain)
    );
  });
}

function chooseCampaign(campaigns: Campaign[]) {
  if (!campaigns.length) return null;
  const totalWeight = campaigns.reduce(
    (total, campaign) => total + Math.max(campaign.weight, 1),
    0,
  );
  let roll = Math.random() * totalWeight;
  for (const campaign of campaigns) {
    roll -= Math.max(campaign.weight, 1);
    if (roll <= 0) return campaign;
  }
  return campaigns[campaigns.length - 1];
}

function clickUrl(campaign: Campaign, staffProfileId?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL;
  if (!baseUrl) return campaign.link_url;
  const url = new URL(
    `/api/signatures/campaigns/${campaign.id}/click`,
    baseUrl,
  );
  if (staffProfileId) url.searchParams.set("staff", staffProfileId);
  return url.toString();
}

function bannerHtml(campaign: Campaign, staffProfileId?: string) {
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character] ?? character,
    );
  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="margin-top:12px;"><tr><td><a href="${escape(clickUrl(campaign, staffProfileId))}" style="display:inline-block;"><img src="${escape(campaign.image_url)}" alt="${escape(campaign.name)}" style="display:block;max-width:600px;width:100%;border:0;" /></a></td></tr></table>`;
}

function recordImpression(campaignId: string) {
  const database = supabaseAdmin as unknown as CampaignDatabase;
  after(async () => {
    const date = new Date().toISOString().slice(0, 10);
    const result = await database
      .from("signature_campaign_daily_stats")
      .select("id, date, impressions")
      .eq("campaign_id", campaignId);
    const current = Array.isArray(result.data)
      ? (result.data.find(
          (item) => (item as { date?: string }).date === date,
        ) as { id: string; impressions: number } | undefined)
      : undefined;
    if (current)
      await database
        .from("signature_campaign_daily_stats")
        .update({ impressions: Number(current.impressions) + 1 })
        .eq("id", current.id);
    else
      await database
        .from("signature_campaign_daily_stats")
        .insert({ campaign_id: campaignId, date, impressions: 1 });
  });
}

/** Adds one eligible campaign banner. Campaigns apply to every managed signature, or only the selected email domain. */
export async function appendCampaignBanner(
  html: string,
  email: string,
  staffProfileId?: string,
  department?: string | null,
  track = false,
) {
  const database = supabaseAdmin as unknown as CampaignDatabase;
  const [result, domains, audienceResult, groupResult] = await Promise.all([
    database
      .from("signature_campaigns")
      .select(
        "id, name, image_url, link_url, domain_id, weight, starts_at, ends_at",
      )
      .eq("active", true),
    database.from("signature_domains").select("id, name"),
    database
      .from("signature_campaign_audiences")
      .select(
        "campaign_id, audience_type, staff_profile_id, staff_group_id, department",
      ),
    database.from("staff_groups").select("id, member_ids"),
  ]);
  if (result.error) throw new Error(result.error.message);
  if (domains.error) throw new Error(domains.error.message);
  if (audienceResult.error) throw new Error(audienceResult.error.message);
  if (groupResult.error) throw new Error(groupResult.error.message);
  const domainNames = new Map(
    ((domains.data ?? []) as Array<{ id: string; name: string }>).map(
      (domain) => [domain.id, domain.name.toLowerCase()],
    ),
  );
  const groups = new Map(
    ((groupResult.data ?? []) as StaffGroup[]).map((group) => [
      group.id,
      group.member_ids,
    ]),
  );
  const campaign = chooseCampaign(
    eligibleCampaigns(
      (result.data ?? []) as Campaign[],
      email,
      domainNames,
      (audienceResult.data ?? []) as Audience[],
      groups,
      staffProfileId,
      department,
    ),
  );
  if (!campaign) return html;
  if (track) recordImpression(campaign.id);
  return `${html}${bannerHtml(campaign, staffProfileId)}`;
}
