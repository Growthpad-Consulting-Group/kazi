import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { NewCycleButton } from "./NewCycleButton";
import type { ReviewCycleRow, ReviewStatus } from "@/types/database";

const STATUS: Record<ReviewStatus, { label: string; className: string; dot: string }> = { pending: { label: "Planning", className: "bg-slate-500/10 text-slate-500", dot: "bg-slate-400" }, self_review: { label: "Self review", className: "bg-blue-500/10 text-blue-600", dot: "bg-blue-500" }, manager_review: { label: "Manager review", className: "bg-amber-500/10 text-amber-600", dot: "bg-amber-500" }, peer_review: { label: "Peer review", className: "bg-sky-500/10 text-sky-600", dot: "bg-sky-500" }, completed: { label: "Completed", className: "bg-emerald-500/10 text-emerald-600", dot: "bg-emerald-500" } };

function dateRange(cycle: ReviewCycleRow) { const date = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }); return `${date(cycle.start_date)} – ${date(cycle.end_date)}`; }

export default async function ReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const isAdmin = can(session.user.role, "manage_reviews");
  const [{ data: cyclesData }, { data: myReviews }] = await Promise.all([
    supabaseAdmin.from("review_cycles").select("*").order("start_date", { ascending: false }),
    supabaseAdmin.from("performance_reviews").select("id").eq("reviewer_id", session.user.id).is("submitted_at", null),
  ]);
  const cycles = (cyclesData ?? []) as unknown as ReviewCycleRow[];
  const pendingCount = (myReviews ?? []).length;
  const active = cycles.filter((cycle) => cycle.status !== "completed");
  const completed = cycles.filter((cycle) => cycle.status === "completed");
  const nextCycle = [...cycles].filter((cycle) => new Date(`${cycle.start_date}T12:00:00`) > new Date()).sort((a, b) => a.start_date.localeCompare(b.start_date))[0];

  return <><SetPageHeader title="Performance reviews" description={pendingCount ? `${pendingCount} review${pendingCount === 1 ? "" : "s"} awaiting your input` : "Your review work is up to date"} icon="solar:clipboard-list-broken" trailing={isAdmin ? <NewCycleButton userId={session.user.id} size="sm" /> : undefined} /><div className="mx-auto max-w-7xl space-y-5"><section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title="Active cycles" value={active.length} icon="solar:refresh-circle-broken" color="blue" compact subtitle={active.length ? "Currently in motion" : "Nothing active"} /><StatCard title="Awaiting you" value={pendingCount} icon="solar:pen-new-square-broken" color={pendingCount ? "amber" : "green"} compact subtitle={pendingCount ? "Your input is needed" : "All caught up"} /><StatCard title="Completed" value={completed.length} icon="solar:check-circle-broken" color="green" compact subtitle={`${cycles.length ? Math.round((completed.length / cycles.length) * 100) : 0}% of all cycles`} /><StatCard title="Next cycle" value={nextCycle ? new Date(`${nextCycle.start_date}T12:00:00`).toLocaleDateString("en-KE", { month: "short", day: "numeric" }) : "—"} icon="solar:calendar-broken" color="orange" compact subtitle={nextCycle?.title ?? "Nothing planned"} /></section>
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:clipboard-list-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Review cycles</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">A clear view of every performance conversation.</p></div></div><span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">{cycles.length} total</span></div>{cycles.length ? <div className="p-3 sm:p-4">{cycles.map((cycle) => { const meta = STATUS[cycle.status]; return <Link key={cycle.id} href={`/pulse/reviews/${cycle.id}`} className="group flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 transition-colors hover:bg-[var(--surface)] sm:flex-nowrap"><span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--text-hi)]">{cycle.title}</span><span className="mt-0.5 block text-[11px] text-[var(--text-lo)]"><span className="capitalize">{cycle.cycle}</span> · {dateRange(cycle)}</span></span><span className={`inline-flex shrink-0 items-center rounded-lg px-2 py-1 text-[10px] font-semibold ${meta.className}`}>{meta.label}</span><Icon icon="solar:arrow-right-broken" className="h-4 w-4 shrink-0 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5" /></Link>; })}</div> : <EmptyState isAdmin={isAdmin} />}</section></div></>;
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) { return <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:clipboard-list-broken" className="h-5 w-5" /></span><h2 className="mt-3 text-sm font-semibold text-[var(--text-hi)]">No review cycles yet</h2><p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--text-lo)]">{isAdmin ? "Start a review cycle when your team is ready for a structured performance conversation." : "Review cycles your team shares with you will appear here."}</p></div>; }
