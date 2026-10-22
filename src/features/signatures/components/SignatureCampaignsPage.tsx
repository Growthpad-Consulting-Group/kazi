/* eslint-disable @next/next/no-img-element -- campaign artwork is stored in Kazi R2 or migrated external URLs. */
import { Icon } from "@iconify/react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";

type QueryResult = { data: unknown; error: { message: string } | null };
type Database = { from: (table: string) => { select: (columns: string) => PromiseLike<QueryResult> } };
type Campaign = { id: string; name: string; image_url: string; link_url: string; active: boolean; starts_at: string | null; ends_at: string | null; variant_label: string | null; weight: number; created_at: string };
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
  if (!session || !can(session.user.role, "manage_signatures")) redirect("/signatures");
  const db = supabaseAdmin as unknown as Database;
  const [campaignResult, statResult] = await Promise.all([
    db.from("signature_campaigns").select("id, name, image_url, link_url, active, starts_at, ends_at, variant_label, weight, created_at"),
    db.from("signature_campaign_daily_stats").select("campaign_id, impressions, clicks"),
  ]);
  if (campaignResult.error) throw new Error(campaignResult.error.message);
  if (statResult.error) throw new Error(statResult.error.message);
  const campaigns = (campaignResult.data ?? []) as Campaign[];
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
    <SetPageHeader title="Signature campaigns" description="Banner campaigns carried by every managed signature." icon="solar:flag-2-broken" actions={[{ label: "Signature builder", icon: "solar:gallery-broken", variant: "secondary", href: "/signatures/templates" }, { label: "Templates", icon: "solar:document-text-broken", variant: "secondary", href: "/signatures/templates" }]} />
    <section className="relative overflow-hidden rounded-3xl border border-brand-500/20 bg-gradient-to-br from-[#2b1108] via-[#1d1411] to-[var(--surface)] p-6 shadow-xl shadow-brand-500/5"><div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand-500/20 blur-3xl" /><div className="relative flex flex-wrap items-end justify-between gap-5"><div><span className="inline-flex items-center gap-2 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-orange-200"><Icon icon="solar:chart-square-broken" className="h-3.5 w-3.5" /> Migrated campaign reporting</span><h1 className="mt-3 text-2xl font-bold tracking-tight text-white">Make every signature a useful touchpoint.</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">Review live artwork, schedules and the historical impression data brought across from Signoff.</p></div><Link href="/signatures/templates" className="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-[#2b1108]">Open builder <Icon icon="solar:arrow-right-broken" className="h-4 w-4" /></Link></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Live campaigns" value={live} icon="solar:bolt-broken" color="orange" variant="flat" compact /><StatCard title="Campaigns" value={campaigns.length} icon="solar:flag-2-broken" color="blue" variant="flat" compact /><StatCard title="Impressions" value={impressions.toLocaleString()} icon="solar:eye-broken" color="green" variant="flat" compact /><StatCard title="Click-through" value={`${ctr.toFixed(1)}%`} icon="solar:cursor-square-broken" color="amber" variant="flat" compact /></section>
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div><h2 className="font-semibold text-[var(--text-hi)]">Campaign library</h2><p className="mt-1 text-sm text-[var(--text-lo)]">Artwork and link performance are retained from the Signoff migration.</p></div><span className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 text-xs font-semibold text-[var(--text-lo)]">{campaigns.length} total</span></div>{campaigns.length ? <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{campaigns.map((campaign) => { const state = campaignState(campaign); const total = totals.get(campaign.id) ?? { impressions: 0, clicks: 0 }; const rate = total.impressions ? (total.clicks / total.impressions) * 100 : 0; return <article key={campaign.id} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]"><div className="aspect-[2.5/1] bg-[var(--surface-2)]"><img src={campaign.image_url} alt="" className="h-full w-full object-cover" /></div><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold text-[var(--text-hi)]">{campaign.name}</h3><a href={campaign.link_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-brand-500 hover:underline">{campaign.link_url}</a></div><span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${state.tone}`}>{state.label}</span></div><div className="mt-4 grid grid-cols-3 divide-x divide-[var(--border)] rounded-xl bg-[var(--surface-2)] py-2 text-center"><div><p className="text-sm font-semibold text-[var(--text-hi)]">{total.impressions.toLocaleString()}</p><p className="text-[10px] text-[var(--text-lo)]">views</p></div><div><p className="text-sm font-semibold text-[var(--text-hi)]">{total.clicks.toLocaleString()}</p><p className="text-[10px] text-[var(--text-lo)]">clicks</p></div><div><p className="text-sm font-semibold text-[var(--text-hi)]">{rate.toFixed(1)}%</p><p className="text-[10px] text-[var(--text-lo)]">CTR</p></div></div>{(campaign.starts_at || campaign.ends_at) && <p className="mt-3 text-xs text-[var(--text-lo)]">{campaign.starts_at ? `Starts ${new Date(campaign.starts_at).toLocaleDateString()}` : "Already started"}{campaign.ends_at ? ` · ends ${new Date(campaign.ends_at).toLocaleDateString()}` : ""}</p>}</div></article>; })}</div> : <div className="mt-5 rounded-xl border border-dashed border-[var(--border)] px-5 py-12 text-center"><Icon icon="solar:flag-2-broken" className="mx-auto h-7 w-7 text-[var(--text-lo)]" /><p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">No campaign banners yet</p><p className="mt-1 text-sm text-[var(--text-lo)]">When campaign artwork is added, its schedule and performance will appear here.</p></div>}</section>
  </div>;
}
