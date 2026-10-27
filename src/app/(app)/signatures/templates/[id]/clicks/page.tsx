import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SignatureClickTrendChart } from "@/features/signatures/components/SignatureClickTrendChart";

type Click = { staff_profile_id: string | null; label: string | null; clicked_at: string };
type Staff = { id: string; full_name: string; photo_url: string | null };
type Result<T> = { data: T | null; error: { message: string } | null };
/* eslint-disable @typescript-eslint/no-explicit-any -- signature tables are not in the generated Supabase types yet */
const database = supabaseAdmin as any;

const DAY_MS = 86_400_000;
const dateTime = (value: string) => new Date(value).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" });
const dateLabel = (value: Date) => value.toLocaleDateString("en-KE", { day: "numeric", month: "short" });

export default async function TemplateClicksPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_signatures")) redirect("/signatures");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const templateResult: Result<{ id: string; name: string }> = await database.from("signature_templates").select("id, name").eq("id", id).maybeSingle();
  if (templateResult.error) throw new Error(templateResult.error.message);
  if (!templateResult.data) notFound();
  const template = templateResult.data;

  const clickResult: Result<Click[]> = await database.from("signature_template_link_clicks").select("staff_profile_id, label, clicked_at").eq("template_id", id);
  if (clickResult.error) throw new Error(clickResult.error.message);
  const clicks = clickResult.data ?? [];

  // Read once per request on the server, so the windows are fixed for this render.
  // eslint-disable-next-line react-hooks/purity -- server component; the time is a per-request input
  const now = Date.now();
  const within = (click: Click, days: number) => now - new Date(click.clicked_at).getTime() <= days * DAY_MS;
  const peopleIds = [...new Set(clicks.map((click) => click.staff_profile_id).filter((value): value is string => Boolean(value)))];

  const staffResult: Result<Staff[]> = peopleIds.length
    ? await database.from("signature_staff_profiles").select("id, full_name, photo_url").in("id", peopleIds)
    : { data: [], error: null };
  if (staffResult.error) throw new Error(staffResult.error.message);
  const names = new Map((staffResult.data ?? []).map((person) => [person.id, person.full_name]));
  const staff = new Map((staffResult.data ?? []).map((person) => [person.id, person]));

  // Per link label: how often it was clicked and when it was last clicked.
  const byLabel = new Map<string, { count: number; last: string }>();
  for (const click of clicks) {
    const label = click.label?.trim() || "Unlabelled link";
    const current = byLabel.get(label);
    byLabel.set(label, {
      count: (current?.count ?? 0) + 1,
      last: !current || click.clicked_at > current.last ? click.clicked_at : current.last,
    });
  }
  const labelRows = [...byLabel.entries()].sort((a, b) => b[1].count - a[1].count);

  // Per person: how many clicks each staff member made, most active first.
  const byPerson = new Map<string, number>();
  for (const click of clicks) {
    if (!click.staff_profile_id) continue;
    byPerson.set(click.staff_profile_id, (byPerson.get(click.staff_profile_id) ?? 0) + 1);
  }
  const personRows = [...byPerson.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const today = new Date(now);
  const trend = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (13 - index));
    const nextDate = new Date(date); nextDate.setDate(date.getDate() + 1);
    return { label: dateLabel(date), clicks: clicks.filter((click) => { const clicked = new Date(click.clicked_at); return clicked >= date && clicked < nextDate; }).length };
  });
  const maxLinkClicks = Math.max(...labelRows.map(([, row]) => row.count), 1);
  const latestClick = [...clicks].sort((a, b) => b.clicked_at.localeCompare(a.clicked_at))[0];

  return (
    <div className="space-y-5">
      <SetPageHeader
        title="Template performance"
        description={`${template.name} · how recipients use the links in this signature.`}
        icon="solar:cursor-square-broken"
        actions={[{ label: "Edit template", icon: "solar:pen-broken", variant: "primary", href: `/signatures/templates/${id}/edit` }, { label: "Back to templates", icon: "solar:arrow-left-broken", variant: "secondary", href: "/signatures/templates" }]}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard variant="inline" compact title="All-time clicks" value={clicks.length} icon="solar:cursor-square-broken" color="orange" />
        <StatCard variant="inline" compact title="Last 7 days" value={clicks.filter((click) => within(click, 7)).length} icon="solar:calendar-broken" color="green" />
        <StatCard variant="inline" compact title="Last 30 days" value={clicks.filter((click) => within(click, 30)).length} icon="solar:calendar-mark-broken" color="blue" />
        <StatCard variant="inline" compact title="Staff tracked" value={peopleIds.length} icon="solar:users-group-two-rounded-broken" color="amber" />
      </section>

      {clicks.length === 0 ? (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"><EmptyState icon="solar:cursor-square-broken" title="No link activity yet" description="Clicks will appear here when recipients use a tracked link in this signature." /></section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-[var(--text-hi)]">Click activity</h2><p className="mt-1 text-sm text-[var(--text-lo)]">The last 14 days of tracked engagement.</p></div>{latestClick && <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500/10 px-2.5 py-1.5 text-xs font-semibold text-brand-500"><Icon icon="solar:clock-circle-broken" className="h-3.5 w-3.5" />Latest {dateTime(latestClick.clicked_at)}</span>}</div><div className="mt-4"><SignatureClickTrendChart data={trend} /></div></section>
          <aside className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:chart-square-broken" className="h-4.5 w-4.5" /></div><h2 className="mt-4 font-semibold text-[var(--text-hi)]">What this measures</h2><p className="mt-2 text-sm leading-6 text-[var(--text-lo)]">Only tagged signature links are recorded. Email opens and untagged links are intentionally not tracked.</p><div className="mt-5 rounded-xl bg-[var(--surface-2)] p-3"><p className="text-xs font-medium text-[var(--text-lo)]">Most-used link</p><p className="mt-1 truncate text-sm font-semibold text-[var(--text-hi)]">{labelRows[0]?.[0] ?? "—"}</p><p className="mt-1 text-xs text-brand-500">{labelRows[0]?.[1].count ?? 0} click{labelRows[0]?.[1].count === 1 ? "" : "s"}</p></div></aside>
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold text-[var(--text-hi)]">Links in this template</h2><p className="mt-1 text-sm text-[var(--text-lo)]">Which signature destinations are getting attention.</p></div><div className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto overscroll-contain">{labelRows.map(([label, row]) => <div key={label} className="px-5 py-4"><div className="flex items-center justify-between gap-4"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-hi)]">{label}</p><p className="mt-0.5 text-xs text-[var(--text-lo)]">Last clicked {dateTime(row.last)}</p></div><p className="shrink-0 text-sm font-bold text-[var(--text-hi)]">{row.count}</p></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-orange-400" style={{ width: `${Math.max((row.count / maxLinkClicks) * 100, 5)}%` }} /></div></div>)}</div></section>
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="border-b border-[var(--border)] px-5 py-4"><h2 className="font-semibold text-[var(--text-hi)]">Staff engagement</h2><p className="mt-1 text-sm text-[var(--text-lo)]">Click activity attributed to an assigned staff signature.</p></div>{personRows.length === 0 ? <EmptyState className="py-10" icon="solar:users-group-two-rounded-broken" title="No staff activity attributed" description="Tracked links will connect to staff as their managed signatures are used." /> : <div className="divide-y divide-[var(--border)]">{personRows.map(([personId, count]) => { const person = staff.get(personId); const name = names.get(personId) ?? "Unknown staff member"; return <div key={personId} className="flex items-center justify-between gap-3 px-5 py-3.5"><div className="flex min-w-0 items-center gap-3"><Avatar name={name} src={person?.photo_url} size="sm" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-hi)]">{name}</p><p className="mt-0.5 text-xs text-[var(--text-lo)]">Managed signature activity</p></div></div><span className="rounded-lg bg-brand-500/10 px-2.5 py-1 text-xs font-bold text-brand-500">{count}</span></div>; })}</div>}</section>
        </div>
      )}

      <p className="text-xs text-[var(--text-lo)]">Opens are not tracked. Only clicks on tracked links are counted, and <Link href="/signatures/templates" className="text-brand-500 hover:underline">templates</Link> show the same total.</p>
    </div>
  );
}
