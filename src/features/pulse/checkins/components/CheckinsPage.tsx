import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { getMyCheckins, getTeamCheckins } from "../actions";
import { CheckinForm } from "./CheckinForm";
import { TeamCheckins } from "./TeamCheckins";

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

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
  return { label: "Ready when you are", description: "A short update helps your manager support you well.", icon: "solar:pen-new-square-broken", className: "bg-[#f05d23]/10 text-[#f05d23]" };
}

export default async function CheckinsPage({ userId: overrideUserId }: { userId?: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = session.user.id;
  const isManager = hasRole(session.user.role, "manager");
  const weekStart = getCurrentWeekStart();
  const [myCheckins, teamCheckins] = await Promise.all([
    getMyCheckins(overrideUserId ?? userId),
    isManager ? getTeamCheckins(userId) : Promise.resolve([]),
  ]);
  const thisWeek = myCheckins.find((checkin) => checkin.week_start === weekStart) ?? null;
  const status = statusMeta(thisWeek?.status);
  const weekRange = weekRangeLabel(weekStart);
  const pastCheckins = myCheckins.filter((checkin) => checkin.week_start !== weekStart).slice(0, 5);

  return (
    <>
      <SetPageHeader title="Weekly check-in" description={weekRange} icon="solar:clipboard-check-broken" />
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6"><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Your update</h2><p className="mt-1 text-xs text-[var(--text-lo)]">{weekRange}</p></div><div className="flex items-center gap-2"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${status.className}`}><Icon icon={status.icon} className="h-3.5 w-3.5" /></span><span><span className="block text-xs font-semibold text-[var(--text-hi)]">{status.label}</span><span className="block text-[10px] text-[var(--text-lo)]">{status.description}</span></span></div></div>
            <div className="p-5 sm:p-6"><CheckinForm userId={overrideUserId ?? userId} weekStart={weekStart} existing={thisWeek} /></div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:history-broken" className="h-3.5 w-3.5" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">Recent check-ins</h2></div>{pastCheckins.length ? <div className="mt-4 space-y-2">{pastCheckins.map((checkin) => <div key={checkin.id} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"><div><p className="text-xs font-semibold text-[var(--text-hi)]">{new Date(`${checkin.week_start}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p><p className="mt-0.5 text-[11px] text-[var(--text-lo)]">{checkin.mood ? `${MOODS[checkin.mood - 1]} ${checkin.status}` : checkin.status}</p></div><StatusBadge status={checkin.status} compact /></div>)}</div> : <EmptyHistory />}</section>
            <section className="rounded-2xl border border-[#f05d23]/15 bg-[#f05d23]/[0.05] p-4"><div className="flex gap-2.5"><Icon icon="solar:lightbulb-broken" className="mt-0.5 h-4 w-4 shrink-0 text-[#f05d23]" /><div><p className="text-xs font-semibold text-[var(--text-hi)]">Keep it useful</p><p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">Specific wins and clear blockers make your next 1-on-1 more productive.</p></div></div></section>
          </aside>
        </div>

        {isManager && <TeamCheckins checkins={teamCheckins} weekStart={weekStart} />}
      </div>
    </>
  );
}

function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const styles: Record<string, string> = { draft: "bg-amber-500/10 text-amber-600", submitted: "bg-blue-500/10 text-blue-600", reviewed: "bg-emerald-500/10 text-emerald-600" };
  return <span className={`rounded-lg px-2 py-1 text-[10px] font-semibold capitalize ${styles[status] ?? "bg-[var(--surface-2)] text-[var(--text-lo)]"} ${compact ? "" : "sm:text-xs"}`}>{status}</span>;
}

function EmptyHistory() {
  return <div className="mt-4 flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 text-center"><Icon icon="solar:history-broken" className="h-5 w-5 text-[var(--text-lo)]" /><p className="mt-2 text-xs text-[var(--text-lo)]">Your submitted check-ins will build a useful history here.</p></div>;
}
