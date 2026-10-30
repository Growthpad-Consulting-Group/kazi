import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { getOneOnOnes } from "../actions";
import { NewOneOnOneButton } from "./NewOneOnOneButton";
import type { OneOnOne } from "@/types/database";

type UserRow = {
  id: string;
  name: string;
  job_title: string | null;
  department?: string | null;
  manager_id?: string | null;
};

function actionsFor(meeting: OneOnOne) {
  const total = meeting.action_items?.length ?? 0;
  const open = meeting.action_items?.filter((item) => !item.done).length ?? 0;
  return { total, open, done: total - open };
}

function dateLabel(date: string | null, includeYear = false) {
  if (!date) return "Not scheduled";
  return new Date(date).toLocaleDateString("en-KE", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  });
}

export default async function OneOnOnesPage({
  reportId,
  view,
}: {
  reportId?: string;
  view?: "upcoming";
}) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = session.user.id;
  const isManager = can(session.user.role, "manage_one_on_ones");
  const isHr = can(session.user.role, "manage_surveys");
  const { data: focusData } =
    reportId && isManager
      ? await supabaseAdmin
          .from("users")
          .select("id, name, job_title, department, manager_id")
          .eq("id", reportId)
          .maybeSingle()
      : { data: null };
  const requestedReport = focusData as UserRow | null;
  const focusedReport =
    requestedReport && (isHr || requestedReport.manager_id === userId)
      ? requestedReport
      : null;
  const [sessions, reports] = await Promise.all([
    getOneOnOnes(
      isManager
        ? focusedReport && isHr
          ? { reportId: focusedReport.id }
          : { managerId: userId, reportId: focusedReport?.id }
        : { reportId: userId },
    ),
    isManager
      ? supabaseAdmin
          .from("users")
          .select("id, name, job_title")
          .eq("manager_id", userId)
          .eq("is_active", true)
          .then((result) => (result.data ?? []) as unknown as UserRow[])
      : Promise.resolve<UserRow[]>([]),
  ]);

  const meetings = sessions as OneOnOne[];
  const participantIds = [
    ...new Set(
      meetings.flatMap((meeting) => [meeting.manager_id, meeting.report_id]),
    ),
  ];
  const participantResult = participantIds.length
    ? await supabaseAdmin
        .from("users")
        .select("id, name, job_title")
        .in("id", participantIds)
    : { data: [] as UserRow[] };
  const people = new Map(
    (participantResult.data ?? []).map((person) => [
      person.id,
      person as UserRow,
    ]),
  );
  const now = new Date();
  const scheduled = meetings.filter((meeting) => meeting.scheduled_at);
  const upcoming = scheduled
    .filter((meeting) => new Date(meeting.scheduled_at!) >= now)
    .sort(
      (a, b) =>
        new Date(a.scheduled_at!).getTime() -
        new Date(b.scheduled_at!).getTime(),
    );
  const previous = scheduled
    .filter((meeting) => new Date(meeting.scheduled_at!) < now)
    .sort(
      (a, b) =>
        new Date(b.scheduled_at!).getTime() -
        new Date(a.scheduled_at!).getTime(),
    );
  const unscheduled = meetings.filter((meeting) => !meeting.scheduled_at);
  const openActions = meetings.reduce(
    (total, meeting) => total + actionsFor(meeting).open,
    0,
  );
  const completedActions = meetings.reduce(
    (total, meeting) => total + actionsFor(meeting).done,
    0,
  );
  const actionTotal = openActions + completedActions;
  const nextMeeting = upcoming[0] ?? null;
  const actionCompletion = actionTotal
    ? Math.round((completedActions / actionTotal) * 100)
    : 0;
  const showingUpcoming = view === "upcoming";

  return (
    <>
      <SetPageHeader
        title={focusedReport ? `${focusedReport.name} · 1-on-1s` : "1-on-1s"}
        description={
          focusedReport
            ? `${focusedReport.job_title ?? "Team member"}${focusedReport.department ? ` · ${focusedReport.department}` : ""}`
            : showingUpcoming
              ? `${upcoming.length} upcoming meeting${upcoming.length === 1 ? "" : "s"}`
              : `${meetings.length} session${meetings.length === 1 ? "" : "s"} · ${openActions} open action item${openActions === 1 ? "" : "s"}`
        }
        icon="solar:chat-round-dots-broken"
        trailing={
          isManager && reports.length ? (
            <NewOneOnOneButton
              managerId={userId}
              reports={reports}
              defaultReportId={focusedReport?.id}
              size="sm"
            />
          ) : undefined
        }
      />
      <div className="mx-auto max-w-7xl space-y-5">
        {focusedReport && (
          <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-orange-400 text-xs font-bold text-white">
                {focusedReport.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                  Viewing conversations with {focusedReport.name}
                </p>
                <p className="mt-0.5 truncate text-xs text-[var(--text-lo)]">
                  {focusedReport.job_title ?? "Team member"}
                  {focusedReport.department
                    ? ` · ${focusedReport.department}`
                    : ""}
                </p>
              </div>
            </div>
            <Link
              href="/pulse/one-on-ones"
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-hi)] hover:bg-[var(--surface-2)]"
            >
              <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />
              All 1-on-1s
            </Link>
          </section>
        )}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Upcoming"
            value={upcoming.length}
            icon="solar:calendar-broken"
            color="blue"
            compact
            subtitle={
              nextMeeting
                ? dateLabel(nextMeeting.scheduled_at)
                : "Nothing scheduled"
            }
          />
          <StatCard
            title="Open actions"
            value={openActions}
            icon="solar:checklist-minimalistic-broken"
            color={openActions ? "amber" : "green"}
            compact
            subtitle={openActions ? "To follow through" : "All caught up"}
          />
          <StatCard
            title="Completed actions"
            value={completedActions}
            icon="solar:check-circle-broken"
            color="green"
            compact
            subtitle={`${actionCompletion}% action completion`}
          />
          <StatCard
            title="Unscheduled"
            value={unscheduled.length}
            icon="solar:calendar-mark-broken"
            color={unscheduled.length ? "orange" : "slate"}
            compact
            subtitle={unscheduled.length ? "Needs a time" : "Calendar is clear"}
          />
        </section>

        {showingUpcoming && (
          <div className="flex items-center justify-between rounded-xl bg-blue-500/10 px-4 py-3 text-sm text-blue-700 dark:text-blue-300">
            <span>Showing upcoming meetings only.</span>
            <Link
              href="/pulse/one-on-ones"
              className="font-semibold hover:underline"
            >
              All meetings
            </Link>
          </div>
        )}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                  <Icon
                    icon="solar:calendar-search-broken"
                    className="h-3.5 w-3.5"
                  />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                    Meeting rhythm
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                    Conversations, shared notes, and the follow-through after
                    them.
                  </p>
                </div>
              </div>
              {isManager && reports.length ? (
                <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
                  {reports.length} direct report
                  {reports.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
            {meetings.length ? (
              <div className="p-3 sm:p-4">
                <MeetingGroup
                  label="Coming up"
                  icon="solar:calendar-broken"
                  meetings={upcoming}
                  people={people}
                  isManager={isManager}
                  empty="No upcoming 1-on-1s."
                />
                {!showingUpcoming && (
                  <>
                    <MeetingGroup
                      label="Unscheduled"
                      icon="solar:calendar-mark-broken"
                      meetings={unscheduled}
                      people={people}
                      isManager={isManager}
                      empty="No unscheduled sessions."
                      spaced
                    />
                    <MeetingGroup
                      label="Previous conversations"
                      icon="solar:history-broken"
                      meetings={previous}
                      people={people}
                      isManager={isManager}
                      empty="No past conversations yet."
                      spaced
                    />
                  </>
                )}
              </div>
            ) : (
              <EmptyState
                isManager={isManager}
                hasReports={reports.length > 0}
              />
            )}
          </section>

          <aside className="space-y-5">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Icon icon="solar:clock-circle-broken" className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Next up
                </h2>
              </div>
              {nextMeeting ? (
                <NextMeeting
                  meeting={nextMeeting}
                  person={people.get(
                    isManager ? nextMeeting.report_id : nextMeeting.manager_id,
                  )}
                  openActions={actionsFor(nextMeeting).open}
                />
              ) : (
                <div className="mt-4 rounded-xl bg-[var(--surface-2)] px-3 py-5 text-center">
                  <Icon
                    icon="solar:calendar-broken"
                    className="mx-auto h-5 w-5 text-[var(--text-lo)]"
                  />
                  <p className="mt-2 text-xs font-semibold text-[var(--text-hi)]">
                    Nothing on the calendar
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-lo)]">
                    {isManager
                      ? "Schedule a conversation when a check-in or goal needs attention."
                      : "Your manager will schedule the next conversation."}
                  </p>
                </div>
              )}
            </section>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <Icon icon="solar:check-circle-broken" className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Follow-through
                </h2>
              </div>
              <div className="mt-4">
                <div className="flex items-end justify-between">
                  <p className="text-xs text-[var(--text-lo)]">
                    Action items completed
                  </p>
                  <span className="font-mono text-2xl font-bold text-[var(--text-hi)]">
                    {actionTotal ? `${actionCompletion}%` : "—"}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
                    style={{ width: `${actionTotal ? actionCompletion : 0}%` }}
                  />
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-lo)]">
                  {!actionTotal
                    ? "No action items yet."
                    : openActions
                      ? `${openActions} action item${openActions === 1 ? " still needs" : "s still need"} follow-through.`
                      : "All action items are complete."}
                </p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

function MeetingGroup({
  label,
  icon,
  meetings,
  people,
  isManager,
  empty,
  spaced = false,
}: {
  label: string;
  icon: string;
  meetings: OneOnOne[];
  people: Map<string, UserRow>;
  isManager: boolean;
  empty: string;
  spaced?: boolean;
}) {
  return (
    <section className={spaced ? "mt-5" : ""}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon icon={icon} className="h-3.5 w-3.5 text-[var(--text-lo)]" />
        <h3 className="text-xs font-semibold text-[var(--text-hi)]">{label}</h3>
        <span className="font-mono text-[10px] text-[var(--text-lo)]">
          {meetings.length}
        </span>
      </div>
      {meetings.length ? (
        <div className="space-y-2">
          {meetings.map((meeting) => (
            <MeetingRow
              key={meeting.id}
              meeting={meeting}
              person={people.get(
                isManager ? meeting.report_id : meeting.manager_id,
              )}
              isManager={isManager}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-3 py-3 text-xs text-[var(--text-lo)]">
          {empty}
        </p>
      )}
    </section>
  );
}

function MeetingRow({
  meeting,
  person,
  isManager,
}: {
  meeting: OneOnOne;
  person: UserRow | undefined;
  isManager: boolean;
}) {
  const actions = actionsFor(meeting);
  return (
    <Link
      href={`/pulse/one-on-ones/${meeting.id}`}
      className="group flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-3 transition-colors hover:bg-[var(--surface)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
        <Icon icon="solar:user-rounded-broken" className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--text-hi)]">
          {person?.name ?? (isManager ? "Direct report" : "Your manager")}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-[var(--text-lo)]">
          {meeting.scheduled_at
            ? `${dateLabel(meeting.scheduled_at, true)}${person?.job_title ? ` · ${person.job_title}` : ""}`
            : (person?.job_title ?? "Choose a time to meet")}
        </span>
      </span>
      <span className="hidden shrink-0 text-right sm:block">
        <span className="block font-mono text-xs font-bold text-[var(--text-hi)]">
          {actions.open}
        </span>
        <span className="block text-[10px] text-[var(--text-lo)]">open</span>
      </span>
      <Icon
        icon="solar:arrow-right-broken"
        className="h-4 w-4 shrink-0 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}

function NextMeeting({
  meeting,
  person,
  openActions,
}: {
  meeting: OneOnOne;
  person: UserRow | undefined;
  openActions: number;
}) {
  return (
    <Link
      href={`/pulse/one-on-ones/${meeting.id}`}
      className="group mt-4 block rounded-xl border border-blue-500/15 bg-blue-500/[0.06] p-4 transition-colors hover:bg-blue-500/10"
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-600">
        {dateLabel(meeting.scheduled_at, true)}
      </p>
      <p className="mt-2 text-sm font-semibold text-[var(--text-hi)]">
        {person?.name ?? "1-on-1 conversation"}
      </p>
      <p className="mt-1 text-xs text-[var(--text-lo)]">
        {person?.job_title ?? "Keep the agenda and follow-ups in one place."}
      </p>
      <div className="mt-4 flex items-center justify-between border-t border-blue-500/15 pt-3">
        <span className="text-[11px] font-medium text-blue-700 dark:text-blue-400">
          {openActions
            ? `${openActions} open action item${openActions === 1 ? "" : "s"}`
            : "Agenda ready"}
        </span>
        <Icon
          icon="solar:arrow-right-broken"
          className="h-4 w-4 text-blue-600 transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}

function EmptyState({
  isManager,
  hasReports,
}: {
  isManager: boolean;
  hasReports: boolean;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
        <Icon icon="solar:chat-round-dots-broken" className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-base font-semibold text-[var(--text-hi)]">
        No conversations yet
      </h2>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--text-lo)]">
        {isManager && hasReports
          ? "Schedule a recurring or one-off conversation to keep context and commitments together."
          : "Your upcoming conversations and shared action items will appear here."}
      </p>
    </div>
  );
}
