/* eslint-disable @next/next/no-img-element -- campaign artwork is stored in Kazi R2 or migrated external URLs. */
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { authOptions } from "@/lib/auth";
import { can, canView } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import NewSignatureCampaignButton from "./NewSignatureCampaignButton";
import CampaignActions from "./CampaignActions";

type QueryResult = { data: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => PromiseLike<QueryResult> } };
type Campaign = { id: string; name: string; image_url: string; link_url: string; active: boolean; domain_id: string | null; starts_at: string | null; ends_at: string | null; variant_label: string | null; weight: number; created_at: string };
type Domain = { id: string; name: string };
type Staff = { id: string; full_name: string; email: string; department: string | null };
type StaffGroup = { id: string; name: string };
type Audience = { campaign_id: string; audience_type: "staff" | "staff_group" | "department"; staff_profile_id: string | null; staff_group_id: string | null; department: string | null };
type DailyStat = { campaign_id: string; impressions: number; clicks: number };

function campaignState(campaign: Campaign) {
  const now = Date.now();
  if (!campaign.active) return { label: "Paused", tone: "bg-slate-500/10 text-slate-600" };
  if (campaign.starts_at && new Date(campaign.starts_at).getTime() > now) return { label: "Scheduled", tone: "bg-blue-500/10 text-blue-600" };
  if (campaign.ends_at && new Date(campaign.ends_at).getTime() < now) return { label: "Ended", tone: "bg-slate-500/10 text-slate-600" };
  return { label: "Live", tone: "bg-emerald-500/10 text-emerald-600" };
}

export default async function SignatureCampaignsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !canView(session.user, "manage_signatures")) redirect("/signatures");
  const db = supabaseAdmin as unknown as Database;
  const [campaignResult, statResult, domainResult, staffResult, groupResult, audienceResult] = await Promise.all([
    db.from("signature_campaigns").select("id, name, image_url, link_url, active, domain_id, starts_at, ends_at, variant_label, weight, created_at"),
    db.from("signature_campaign_daily_stats").select("campaign_id, impressions, clicks"),
    db.from("signature_domains").select("id, name"),
    db.from("signature_staff_profiles").select("id, full_name, email, department"),
    db.from("staff_groups").select("id, name"),
    db.from("signature_campaign_audiences").select("campaign_id, audience_type, staff_profile_id, staff_group_id, department"),
  ]);
  if (campaignResult.error) throw new Error(campaignResult.error.message);
  if (statResult.error) throw new Error(statResult.error.message);
  if (domainResult.error) throw new Error(domainResult.error.message);
  if (staffResult.error) throw new Error(staffResult.error.message);
  if (groupResult.error) throw new Error(groupResult.error.message);
  if (audienceResult.error) throw new Error(audienceResult.error.message);
  const campaigns = (campaignResult.data ?? []) as Campaign[];
  const domains = (domainResult.data ?? []) as Domain[];
  const staff = (staffResult.data ?? []) as Staff[];
  const groups = (groupResult.data ?? []) as StaffGroup[];
  const audiences = (audienceResult.data ?? []) as Audience[];
  const stats = (statResult.data ?? []) as DailyStat[];
  const totals = new Map<string, { impressions: number; clicks: number }>();
  for (const stat of stats) {
    const total = totals.get(stat.campaign_id) ?? { impressions: 0, clicks: 0 };
    total.impressions += Number(stat.impressions); total.clicks += Number(stat.clicks); totals.set(stat.campaign_id, total);
  }
  const live = campaigns.filter((campaign) => campaignState(campaign).label === "Live").length;
  const impressions = [...totals.values()].reduce((sum, total) => sum + total.impressions, 0);
  const clicks = [...totals.values()].reduce((sum, total) => sum + total.clicks, 0);
  const ctr = impressions ? (clicks / impressions) * 100 : 0;

  return <div className="space-y-6">
    <SetPageHeader title="Signature campaigns" description="Banner campaigns carried by every managed signature." icon="solar:flag-2-broken" actions={[{ label: "Templates", icon: "solar:document-text-broken", variant: "secondary", href: "/signatures/templates" }]} trailing={<NewSignatureCampaignButton domains={domains} staff={staff} groups={groups} />} />
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Live campaigns" value={live} icon="solar:bolt-broken" color="orange" variant="flat" compact /><StatCard title="Campaigns" value={campaigns.length} icon="solar:flag-2-broken" color="blue" variant="flat" compact /><StatCard title="Impressions" value={impressions.toLocaleString()} icon="solar:eye-broken" color="green" variant="flat" compact /><StatCard title="Click-through" value={`${ctr.toFixed(1)}%`} icon="solar:cursor-square-broken" color="amber" variant="flat" compact /></section>
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-[var(--text-hi)]">Campaign library</h2><p className="mt-1 text-sm text-[var(--text-lo)]">Artwork, scheduling and link performance for each signature banner.</p></div><span className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--text-lo)]">{campaigns.length} total</span></div>{campaigns.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{campaigns.map((campaign) => { const state = campaignState(campaign); const total = totals.get(campaign.id) ?? { impressions: 0, clicks: 0 }; const rate = total.impressions ? (total.clicks / total.impressions) * 100 : 0; const domain = domains.find((item) => item.id === campaign.domain_id); const targetCount = audiences.filter((audience) => audience.campaign_id === campaign.id).length; return <article key={campaign.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="aspect-[2.5/1] bg-[var(--surface-2)]"><img src={campaign.image_url} alt="" className="h-full w-full object-cover" /></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[var(--text-hi)]">{campaign.name}</h3><a href={campaign.link_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-brand-500 hover:underline">{campaign.link_url}</a></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${state.tone}`}>{state.label}</span></div><p className="mt-3 text-xs text-[var(--text-lo)]">{targetCount ? `${targetCount} selected audience${targetCount === 1 ? "" : "s"}` : "All signature staff"}{domain ? ` · ${domain.name} only` : ""}{campaign.weight > 1 ? ` · weight ${campaign.weight}` : ""}</p><div className="mt-4 grid grid-cols-3 divide-x divide-[var(--border)] rounded-xl bg-[var(--surface-2)] py-2 text-center"><div><p className="text-sm font-semibold text-[var(--text-hi)]">{total.impressions.toLocaleString()}</p><p className="text-[10px] text-[var(--text-lo)]">views</p></div><div><p className="text-sm font-semibold text-[var(--text-hi)]">{total.clicks.toLocaleString()}</p><p className="text-[10px] text-[var(--text-lo)]">clicks</p></div><div><p className="text-sm font-semibold text-[var(--text-hi)]">{rate.toFixed(1)}%</p><p className="text-[10px] text-[var(--text-lo)]">CTR</p></div></div>{(campaign.starts_at || campaign.ends_at) && <p className="mt-3 text-xs text-[var(--text-lo)]">{campaign.starts_at ? `Starts ${new Date(campaign.starts_at).toLocaleDateString()}` : "Already started"}{campaign.ends_at ? ` · ends ${new Date(campaign.ends_at).toLocaleDateString()}` : ""}</p>}<CampaignActions campaign={campaign} domains={domains} staff={staff} groups={groups} audiences={audiences} /></div></article>; })}</div> : <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] px-5 py-12 text-center"><Icon icon="solar:flag-2-broken" className="mx-auto h-7 w-7 text-[var(--text-lo)]" /><p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">No campaign banners yet</p><p className="mt-1 text-sm text-[var(--text-lo)]">When campaign artwork is added, its schedule and performance will appear here.</p></div>}</section>
  </div>;
}
