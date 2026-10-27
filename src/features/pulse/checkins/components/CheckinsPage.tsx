import { Icon } from "@iconify/react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { getMyCheckins, getTeamCheckins } from "../actions";
import { CheckinForm } from "./CheckinForm";
import { TeamCheckins } from "./TeamCheckins";

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];
type ProfileUser = { id: string; name: string; email: string; job_title: string | null; department: string | null; manager_id: string | null };

function getCurrentWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function weekRangeLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 4);
  const day = new Intl.DateTimeFormat("en-KE", { day: "numeric" });
  const monthYear = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "long", year: "numeric" });
  const monthDay = new Intl.DateTimeFormat("en-KE", { day: "numeric", month: "long" });

  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) return `${day.format(start)} – ${monthYear.format(end)}`;
  if (start.getFullYear() === end.getFullYear()) return `${monthDay.format(start)} – ${monthYear.format(end)}`;
  return `${monthYear.format(start)} – ${monthYear.format(end)}`;
}

function statusMeta(status?: string) {
  if (status === "reviewed") return { label: "Reviewed", description: "Your manager has shared feedback.", icon: "solar:check-circle-broken", className: "bg-emerald-500/10 text-emerald-600" };
  if (status === "submitted") return { label: "Submitted", description: "Your update is with your manager.", icon: "solar:check-circle-broken", className: "bg-blue-500/10 text-blue-600" };
  if (status === "draft") return { label: "Draft saved", description: "Finish and submit when you are ready.", icon: "solar:document-text-broken", className: "bg-amber-500/10 text-amber-600" };
  return { label: "Ready when you are", description: "A short update helps your manager support you well.", icon: "solar:pen-new-square-broken", className: "bg-brand-500/10 text-brand-500" };
}

export default async function CheckinsPage({ userId: overrideUserId, teamOnly }: { userId?: string; teamOnly?: boolean }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = session.user.id;
  const isManager = can(session.user.role, "manage_checkins");
  const isHr = can(session.user.role, "manage_surveys");
  const requestedProfileId = overrideUserId && overrideUserId !== userId ? overrideUserId : null;
  const { data: profileData } = requestedProfileId && (isManager || isHr)
    ? await supabaseAdmin.from("users").select("id, name, email, job_title, department, manager_id").eq("id", requestedProfileId).maybeSingle()
    : { data: null };
  const profile = profileData as ProfileUser | null;
  const canViewProfile = !!profile && (isHr || profile.manager_id === userId);
  const viewedUserId = canViewProfile ? profile.id : userId;
  const weekStart = getCurrentWeekStart();
  const [myCheckins, teamCheckins] = await Promise.all([
    teamOnly ? Promise.resolve([]) : getMyCheckins(viewedUserId),
    isManager && !canViewProfile ? getTeamCheckins(userId) : Promise.resolve([]),
  ]);

  // Team-only view: skip the personal form and go straight to the team overview
  if (teamOnly && isManager) {
    return (
      <>
        <SetPageHeader title="Team check-ins" description={`Week of ${weekRangeLabel(weekStart)}`} icon="solar:users-group-two-rounded-broken" actions={[{ label: "Pulse dashboard", icon: "solar:pulse-broken", variant: "secondary", href: "/pulse" }, { label: "Daily activity", icon: "solar:notebook-broken", variant: "secondary", href: "/pulse/checkins?tab=daily" }]} />
        <div className="mx-auto max-w-7xl">
          <TeamCheckins checkins={teamCheckins} weekStart={weekStart} />
        </div>
      </>
    );
  }
  const thisWeek = myCheckins.find((checkin) => checkin.week_start === weekStart) ?? null;
  const status = statusMeta(thisWeek?.status);
  const weekRange = weekRangeLabel(weekStart);
  // Recent history is a record of submitted work, including the current week
  // once it has been sent to a manager. Drafts deliberately stay out of it.
  const pastCheckins = myCheckins.filter((checkin) => checkin.status !== "draft").slice(0, 5);

  if (canViewProfile && profile) {
    const initials = profile.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
    return <><SetPageHeader title={`${profile.name} · Check-ins`} description={`${profile.job_title ?? "Team member"}${profile.department ? ` · ${profile.department}` : ""}`} icon="solar:user-id-broken" /><div className="mx-auto max-w-7xl space-y-5"><section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"><div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#f05d23]/10 blur-3xl" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f05d23] to-orange-400 text-sm font-bold text-white">{initials}</span><div className="min-w-0"><h1 className="truncate text-lg font-semibold text-[var(--text-hi)]">{profile.name}</h1><p className="mt-0.5 truncate text-sm text-[var(--text-lo)]">{profile.job_title ?? "Team member"}{profile.department ? ` · ${profile.department}` : ""}</p><p className="mt-0.5 truncate text-xs text-[var(--text-lo)]">{profile.email}</p></div></div><div className="flex flex-wrap gap-2"><Link href="/staff" className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-hi)] hover:bg-[var(--surface-2)]"><Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />Staff</Link><Link href={`/pulse/one-on-ones?report=${profile.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[#f05d23] px-3 py-2 text-xs font-medium text-white hover:bg-[#d94f1e]"><Icon icon="solar:chat-round-dots-broken" className="h-4 w-4" />1-on-1s</Link></div></div></section><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]"><section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6"><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">This week&apos;s check-in</h2><p className="mt-1 text-xs text-[var(--text-lo)]">{weekRange}</p></div>{thisWeek && <StatusBadge status={thisWeek.status} />}</div>{thisWeek ? <div className="grid gap-4 p-5 sm:p-6"><CheckinProfileBlock label="Wins" icon="solar:cup-star-broken" value={thisWeek.wins} /><CheckinProfileBlock label="Priorities" icon="solar:flag-broken" value={thisWeek.priorities} /><CheckinProfileBlock label="Blockers" icon="solar:danger-triangle-broken" value={thisWeek.blockers} tone={thisWeek.blockers ? "amber" : "default"} />{thisWeek.manager_comment && <CheckinProfileBlock label="Manager note" icon="solar:chat-round-line-broken" value={thisWeek.manager_comment} tone="orange" />}</div> : <div className="flex min-h-60 flex-col items-center justify-center px-5 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--text-lo)]"><Icon icon="solar:clipboard-remove-broken" className="h-5 w-5" /></span><p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">No check-in submitted this week</p><p className="mt-1 text-xs text-[var(--text-lo)]">There is no update to review yet.</p></div>}</section><aside className="space-y-5"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[var(--text-hi)]">Current pulse</p><p className="mt-0.5 text-xs text-[var(--text-lo)]">This week&apos;s signal</p></div><span className="text-2xl">{thisWeek?.mood ? MOODS[thisWeek.mood - 1] : "—"}</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[#f05d23] to-orange-400" style={{ width: `${(thisWeek?.mood ?? 0) * 20}%` }} /></div><p className="mt-2 text-xs text-[var(--text-lo)]">{thisWeek?.mood ? `${thisWeek.mood} out of 5 mood score` : "No mood score recorded"}</p></section><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:history-broken" className="h-3.5 w-3.5" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">Recent check-ins</h2></div>{pastCheckins.length ? <div className="mt-4 space-y-2">{pastCheckins.map((checkin) => <div key={checkin.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"><div><p className="text-xs font-semibold text-[var(--text-hi)]">{new Date(`${checkin.week_start}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p><p className="mt-0.5 text-[11px] text-[var(--text-lo)]">{checkin.mood ? `${MOODS[checkin.mood - 1]} ${checkin.status}` : checkin.status}</p></div><StatusBadge status={checkin.status} compact /></div>)}</div> : <EmptyHistory />}</section></aside></div></div></>;
  }

  return (
    <>
      <SetPageHeader title="Your weekly check-in" description={`Week of ${weekRange}`} icon="solar:clipboard-check-broken" actions={isManager ? [{ label: "Team review", icon: "solar:users-group-two-rounded-broken", variant: "secondary", href: "/pulse/checkins?tab=team" }] : undefined} />
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid gap-3 sm:grid-cols-3"><StatCard title="Current status" value={status.label.replace(" when you are", "")} icon={status.icon} color={thisWeek?.status === "reviewed" ? "green" : thisWeek?.status === "submitted" ? "blue" : thisWeek?.status === "draft" ? "amber" : "orange"} variant="inline" compact /><StatCard title="Week ending" value={new Date(`${weekStart}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" })} icon="solar:calendar-broken" color="blue" variant="inline" compact subtitle="Monday to Friday" /><StatCard title="Your pulse" value={thisWeek?.mood ? `${MOODS[thisWeek.mood - 1]}` : "—"} icon="solar:heart-pulse-broken" color={thisWeek?.mood && thisWeek.mood <= 2 ? "amber" : "green"} variant="inline" compact subtitle={thisWeek?.mood ? `${thisWeek.mood} out of 5` : "Share how you are"} /></section>
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-gradient-to-r from-brand-500/[0.06] to-transparent px-5 py-4 sm:px-6"><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Your update</h2><p className="mt-1 text-xs text-[var(--text-lo)]">A quick look back, then forward.</p></div><div className="flex items-center gap-2"><span className={`flex h-8 w-8 items-center justify-center rounded-xl ${status.className}`}><Icon icon={status.icon} className="h-4 w-4" /></span><span><span className="block text-xs font-semibold text-[var(--text-hi)]">{status.label}</span><span className="block text-[10px] text-[var(--text-lo)]">{status.description}</span></span></div></div>
            <div className="p-5 sm:p-6"><CheckinForm userId={userId} weekStart={weekStart} existing={thisWeek} /></div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="solar:history-broken" className="h-3.5 w-3.5" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">Recent check-ins</h2></div>{pastCheckins.length ? <div className="mt-4 space-y-2">{pastCheckins.map((checkin) => <div key={checkin.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"><div><p className="text-xs font-semibold text-[var(--text-hi)]">{new Date(`${checkin.week_start}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p><p className="mt-0.5 text-[11px] text-[var(--text-lo)]">{checkin.mood ? `${MOODS[checkin.mood - 1]} ${checkin.status}` : checkin.status}</p></div><StatusBadge status={checkin.status} compact /></div>)}</div> : <EmptyHistory />}</section>
            <section className="rounded-2xl border border-brand-500/15 bg-brand-500/[0.05] p-4"><div className="flex gap-2.5"><Icon icon="solar:lightbulb-broken" className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><div><p className="text-xs font-semibold text-[var(--text-hi)]">Keep it useful</p><p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">Specific wins and clear blockers make your next 1-on-1 more productive.</p></div></div></section>
          </aside>
        </div>

        {isManager && <TeamCheckins checkins={teamCheckins} weekStart={weekStart} />}
      </div>
    </>
  );
}

function CheckinProfileBlock({ label, icon, value, tone = "default" }: { label: string; icon: string; value: string | null; tone?: "default" | "amber" | "orange" }) {
  const styles = { default: "bg-[var(--surface-2)] text-[var(--text-lo)]", amber: "bg-amber-500/10 text-amber-700", orange: "bg-brand-500/10 text-brand-500" };
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/35 p-4"><div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${styles[tone]}`}><Icon icon={icon} className="h-3.5 w-3.5" /></span><h3 className="text-xs font-semibold text-[var(--text-hi)]">{label}</h3></div><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-lo)]">{value || "Nothing shared."}</p></div>;
}

function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const styles: Record<string, string> = { draft: "bg-amber-500/10 text-amber-600", submitted: "bg-blue-500/10 text-blue-600", reviewed: "bg-emerald-500/10 text-emerald-600" };
  return <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold capitalize ${styles[status] ?? "bg-[var(--surface-2)] text-[var(--text-lo)]"} ${compact ? "" : "sm:text-xs"}`}>{status}</span>;
}

function EmptyHistory() {
  return <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 text-center"><Icon icon="solar:history-broken" className="h-5 w-5 text-[var(--text-lo)]" /><p className="mt-2 text-xs text-[var(--text-lo)]">Your submitted check-ins will build a useful history here.</p></div>;
}
