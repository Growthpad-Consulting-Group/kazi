import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";

type GoalSummary = { id: string; title: string; status: string; progress: number; due_date: string | null };
type CheckinSummary = { status: "draft" | "submitted" | "reviewed"; mood: number | null; blockers: string | null };
type OneOnOneSummary = { id: string; scheduled_at: string | null; action_items: { text: string; done: boolean }[] };
type FeedbackSummary = { id: string; from_user_id: string; message: string; emoji: string | null };
type PersonSummary = { id: string; name: string; job_title: string | null };

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

function getCurrentWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

function weekLabel(weekStart: string) {
  return new Date(`${weekStart}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "long" });
}

function statusMeta(status?: CheckinSummary["status"]) {
  if (status === "reviewed") return { label: "Reviewed", icon: "solar:check-circle-broken" };
  if (status === "submitted") return { label: "Submitted", icon: "solar:check-circle-broken" };
  if (status === "draft") return { label: "Draft saved", icon: "solar:document-text-broken" };
  return { label: "Not started", icon: "solar:pen-new-square-broken" };
}

function daysUntil(date: string | null) {
  if (!date) return null;
  const days = Math.ceil((new Date(`${date}T12:00:00`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  return `Due in ${days}d`;
}

export default async function PulseDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = session.user.id;
  const isManager = hasRole(session.user.role, "manager");
  const weekStart = getCurrentWeekStart();
  const now = new Date();
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  const [checkinResult, goalsResult, oneOnOnesResult, feedbackResult, reportsResult] = await Promise.all([
    supabaseAdmin.from("checkins").select("status, mood, blockers").eq("user_id", userId).eq("week_start", weekStart).maybeSingle(),
    supabaseAdmin.from("goals").select("id, title, status, progress, due_date").eq("owner_id", userId).order("due_date", { ascending: true, nullsFirst: false }),
    supabaseAdmin.from("one_on_ones").select("id, scheduled_at, action_items").or(`manager_id.eq.${userId},report_id.eq.${userId}`).order("scheduled_at", { ascending: true, nullsFirst: false }).limit(12),
    supabaseAdmin.from("feedback").select("id, from_user_id, message, emoji").eq("to_user_id", userId).eq("visibility", "public").order("created_at", { ascending: false }).limit(3),
    isManager ? supabaseAdmin.from("users").select("id, name, job_title").eq("manager_id", userId).eq("is_active", true) : Promise.resolve({ data: [] as PersonSummary[] }),
  ]);

  const checkin = checkinResult.data as CheckinSummary | null;
  const goals = (goalsResult.data ?? []) as GoalSummary[];
  const oneOnOnes = (oneOnOnesResult.data ?? []) as OneOnOneSummary[];
  const feedback = (feedbackResult.data ?? []) as FeedbackSummary[];
  const reports = (reportsResult.data ?? []) as PersonSummary[];
  const openGoals = goals.filter((goal) => !["completed", "cancelled"].includes(goal.status));
  const atRiskGoals = openGoals.filter((goal) => goal.status === "at_risk");
  const upcomingOneOnOne = oneOnOnes.find((meeting) => meeting.scheduled_at && new Date(meeting.scheduled_at) >= now) ?? oneOnOnes[0];

  const senders = feedback.length
    ? await supabaseAdmin.from("users").select("id, name").in("id", feedback.map((item) => item.from_user_id))
    : { data: [] as Pick<PersonSummary, "id" | "name">[] };
  const senderName = new Map((senders.data ?? []).map((person) => [person.id, person.name]));

  let team: { total: number; submitted: number; avgMood: number | null; blockers: number } | null = null;
  if (isManager && reports.length) {
    const { data } = await supabaseAdmin.from("checkins").select("status, mood, blockers").in("user_id", reports.map((report) => report.id)).eq("week_start", weekStart);
    const teamCheckins = (data ?? []) as CheckinSummary[];
    const moods = teamCheckins.flatMap((entry) => entry.mood === null ? [] : [entry.mood]);
    team = {
      total: reports.length,
      submitted: teamCheckins.filter((entry) => entry.status === "submitted" || entry.status === "reviewed").length,
      avgMood: moods.length ? Math.round((moods.reduce((sum, mood) => sum + mood, 0) / moods.length) * 10) / 10 : null,
      blockers: teamCheckins.filter((entry) => Boolean(entry.blockers?.trim())).length,
    };
  }

  const checkinStatus = statusMeta(checkin?.status);
  const checkinHref = "/pulse/checkins";

  return (
    <>
      <SetPageHeader
        title="Kazi Pulse"
        description={`Week of ${weekLabel(weekStart)}`}
        icon="solar:heart-pulse-broken"
        actions={[
          { label: checkin ? "View check-in" : "Check in", icon: "solar:pen-new-square-broken", href: checkinHref, variant: "primary" },
          { label: "My goals", icon: "solar:target-broken", href: "/pulse/goals", variant: "secondary" },
        ]}
      />

      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:px-6">
          <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#f05d23]/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f05d23]">Your performance workspace</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-hi)] sm:text-2xl">Good {now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, {firstName}.</h1>
              <p className="mt-1 text-sm text-[var(--text-lo)]">Keep priorities, conversations, and progress in one calm weekly rhythm.</p>
            </div>
            <Link href={checkinHref} className="group flex min-w-64 items-center gap-3 rounded-2xl border border-[#f05d23]/20 bg-[#f05d23]/[0.06] p-3.5 transition-colors hover:bg-[#f05d23]/10">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f05d23] text-white shadow-lg shadow-[#f05d23]/25"><Icon icon={checkinStatus.icon} className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-medium text-[var(--text-lo)]">This week&apos;s check-in</span><span className="mt-0.5 block text-sm font-semibold text-[var(--text-hi)]">{checkin ? checkinStatus.label : "Share your weekly update"}</span></span>
              <Icon icon="solar:arrow-right-broken" className="h-4 w-4 text-[#f05d23] transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Check-in" value={checkin ? checkinStatus.label : "Due"} icon="solar:clipboard-check-broken" color={checkin ? (checkin.status === "reviewed" ? "green" : "blue") : "orange"} compact subtitle={checkin?.mood ? `${MOODS[checkin.mood - 1]} Mood recorded` : "Week of progress"} href={checkinHref} />
          <StatCard title="Active goals" value={openGoals.length} icon="solar:target-broken" color="blue" compact subtitle={atRiskGoals.length ? `${atRiskGoals.length} needs attention` : "On your radar"} href="/pulse/goals" />
          <StatCard title="1-on-1 actions" value={oneOnOnes.reduce((sum, meeting) => sum + meeting.action_items.filter((item) => !item.done).length, 0)} icon="solar:chat-round-dots-broken" color="amber" compact subtitle={upcomingOneOnOne?.scheduled_at ? "A conversation ahead" : "Nothing scheduled"} href="/pulse/one-on-ones" />
          <StatCard title="Recognition" value={feedback.length} icon="solar:star-fall-broken" color="green" compact subtitle={feedback.length ? "Recent kudos" : "Share appreciation"} href="/pulse/feedback" />
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.85fr)]">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
            <SectionTitle icon="solar:target-broken" title="Focus and goals" href="/pulse/goals" action="View all" />
            {openGoals.length ? <div className="space-y-3">{openGoals.slice(0, 4).map((goal) => {
              const due = daysUntil(goal.due_date);
              const atRisk = goal.status === "at_risk" || (due?.includes("overdue") ?? false);
              return <Link key={goal.id} href="/pulse/goals" className="group block rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 transition-colors hover:bg-[var(--surface)]">
                <div className="flex items-start justify-between gap-3"><p className="min-w-0 truncate text-sm font-semibold text-[var(--text-hi)]">{goal.title}</p>{due && <span className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${atRisk ? "bg-red-500/10 text-red-500" : "bg-[var(--surface)] text-[var(--text-lo)]"}`}>{due}</span>}</div>
                <div className="mt-2.5 flex items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]"><div className={`h-full rounded-full ${atRisk ? "bg-red-500" : "bg-[#f05d23]"}`} style={{ width: `${goal.progress}%` }} /></div><span className="w-8 text-right font-mono text-[10px] font-semibold text-[var(--text-lo)]">{goal.progress}%</span></div>
              </Link>;
            })}</div> : <EmptyState icon="solar:target-broken" text="No active goals yet." href="/pulse/goals" action="Explore goals" />}
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
            <SectionTitle icon="solar:chat-round-dots-broken" title="Your next conversation" href="/pulse/one-on-ones" action="All 1-on-1s" />
            {upcomingOneOnOne ? <Link href={`/pulse/one-on-ones/${upcomingOneOnOne.id}`} className="group block rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-colors hover:bg-[var(--surface)]">
              <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><Icon icon="solar:calendar-broken" className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-[var(--text-hi)]">{upcomingOneOnOne.scheduled_at ? new Date(upcomingOneOnOne.scheduled_at).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "short" }) : "1-on-1 to schedule"}</p><p className="mt-1 text-xs text-[var(--text-lo)]">{upcomingOneOnOne.action_items.filter((item) => !item.done).length ? `${upcomingOneOnOne.action_items.filter((item) => !item.done).length} open action item${upcomingOneOnOne.action_items.filter((item) => !item.done).length === 1 ? "" : "s"}` : "Agenda and notes are ready when you are."}</p></div><Icon icon="solar:arrow-right-broken" className="mt-1 h-4 w-4 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5" /></div>
            </Link> : <EmptyState icon="solar:calendar-broken" text="No 1-on-1 is scheduled." href="/pulse/one-on-ones" action="Open 1-on-1s" />}

            {checkin?.blockers?.trim() && <div className="mt-4 rounded-xl border border-amber-500/15 bg-amber-500/5 p-3"><div className="flex gap-2"><Icon icon="solar:danger-triangle-broken" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /><div><p className="text-xs font-semibold text-[var(--text-hi)]">Your current blocker</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-lo)]">{checkin.blockers}</p></div></div></div>}
          </section>
        </div>

        {isManager && team && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:users-group-two-rounded-broken" className="h-3.5 w-3.5" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">Team radar</h2></div><p className="mt-2 text-xs text-[var(--text-lo)]">A quiet read on this week&apos;s check-ins and support needs.</p></div><Link href="/pulse/checkins" className="inline-flex items-center gap-1 text-xs font-semibold text-[#f05d23] hover:text-[#d94f1c]">Review check-ins <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" /></Link></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><MiniMetric label="Submitted" value={`${team.submitted}/${team.total}`} tone="orange" /><MiniMetric label="Awaiting" value={team.total - team.submitted} tone="amber" /><MiniMetric label="Average mood" value={team.avgMood === null ? "—" : `${MOODS[Math.max(0, Math.min(4, Math.round(team.avgMood) - 1))]} ${team.avgMood}`} tone="blue" /><MiniMetric label="Blockers" value={team.blockers} tone={team.blockers ? "red" : "green"} /></div></section>}

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"><SectionTitle icon="solar:star-fall-broken" title="Recent recognition" href="/pulse/feedback" action="Give feedback" />{feedback.length ? <div className="space-y-3">{feedback.map((item) => <div key={item.id} className="flex gap-3 rounded-xl bg-[var(--surface-2)] p-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-sm">{item.emoji ?? "✨"}</span><div className="min-w-0"><p className="text-xs font-semibold text-[var(--text-hi)]">{senderName.get(item.from_user_id) ?? "A teammate"}</p><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--text-lo)]">{item.message}</p></div></div>)}</div> : <EmptyState icon="solar:star-fall-broken" text="Recognition from teammates will appear here." href="/pulse/feedback" action="Send feedback" />}</section>
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"><SectionTitle icon="solar:bolt-broken" title="Keep moving" /><div className="grid grid-cols-2 gap-2"><QuickLink href="/pulse/checkins" icon="solar:clipboard-check-broken" label="Weekly check-in" /><QuickLink href="/pulse/goals" icon="solar:target-broken" label="Update goals" /><QuickLink href="/pulse/one-on-ones" icon="solar:chat-round-dots-broken" label="Prepare 1-on-1" /><QuickLink href="/pulse/feedback" icon="solar:star-fall-broken" label="Recognize someone" /></div></section>
        </div>
      </div>
    </>
  );
}

function SectionTitle({ icon, title, href, action }: { icon: string; title: string; href?: string; action?: string }) {
  return <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#f05d23]/10 text-[#f05d23]"><Icon icon={icon} className="h-3.5 w-3.5" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">{title}</h2></div>{href && action && <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-[#f05d23] hover:text-[#d94f1c]">{action}<Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" /></Link>}</div>;
}

function EmptyState({ icon, text, href, action }: { icon: string; text: string; href: string; action: string }) {
  return <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 text-center"><Icon icon={icon} className="h-5 w-5 text-[var(--text-lo)]" /><p className="mt-2 text-xs text-[var(--text-lo)]">{text}</p><Link href={href} className="mt-2 text-xs font-semibold text-[#f05d23] hover:text-[#d94f1c]">{action}</Link></div>;
}

function MiniMetric({ label, value, tone }: { label: string; value: string | number; tone: "orange" | "amber" | "blue" | "red" | "green" }) {
  const tones = { orange: "bg-[#f05d23]/10 text-[#f05d23]", amber: "bg-amber-500/10 text-amber-600", blue: "bg-blue-500/10 text-blue-600", red: "bg-red-500/10 text-red-500", green: "bg-emerald-500/10 text-emerald-600" };
  return <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"><p className={`inline-flex rounded-md px-1.5 py-0.5 font-mono text-sm font-bold ${tones[tone]}`}>{value}</p><p className="mt-2 text-xs font-medium text-[var(--text-lo)]">{label}</p></div>;
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return <Link href={href} className="group flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 transition-colors hover:bg-[var(--surface)]"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f05d23]/10 text-[#f05d23]"><Icon icon={icon} className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1 text-xs font-semibold text-[var(--text-hi)]">{label}</span><Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5" /></Link>;
}
