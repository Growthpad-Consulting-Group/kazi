import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { EditSideQuestButton, NewSideQuestButton } from "./SideQuestFormModal";
import { QuestCompletionButton } from "./QuestCompletionButton";
import { QuestCompletionReviewButton } from "./QuestCompletionReviewButton";
import { effectiveSideQuestStatus } from "@/lib/side-quest-lifecycle";

const audienceLabels: Record<string, string> = {
  company: "Company-wide",
  department: "Department",
  location: "Location",
  manager_group: "Manager group",
  staff: "Selected staff",
};

export default async function SideQuestsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const canManage = userCan(session.user, "manage_side_quests");
  const [
    { data: quests },
    { data: completions },
    { data: staff },
    { data: xpWallets },
    { data: achievements },
  ] = await Promise.all([
    supabaseAdmin
      .from("side_quests")
      .select("*")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("side_quest_completions")
      .select(
        "side_quest_id, user_id, status, evidence_note, evidence_url, evidence_file_url, completed_at",
      ),
    supabaseAdmin
      .from("users")
      .select("id, name, role, department, location, manager_id")
      .eq("is_active", true)
      .order("name"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- quarterly XP table is migration-backed and remains separate from reward points
    (supabaseAdmin as any)
      .from("xp_wallets")
      .select("user_id, quarter_start, quarterly_balance")
      .gt("quarterly_balance", 0)
      .order("quarterly_balance", { ascending: false })
      .limit(5),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed achievements table awaits generated types
    (supabaseAdmin as any)
      .from("staff_achievements")
      .select("id, title, description, icon")
      .eq("user_id", session.user.id)
      .order("awarded_at", { ascending: false }),
  ]);
  const quarterStart = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      Math.floor(new Date().getUTCMonth() / 3) * 3,
      1,
    ),
  )
    .toISOString()
    .slice(0, 10);
  const questsWithLifecycle = (quests ?? []).map((quest) => ({
    ...quest,
    status: effectiveSideQuestStatus(quest),
  }));
  const completionByQuest = new Map<string, Set<string>>();
  for (const completion of completions ?? []) {
    if (completion.status !== "approved") continue;
    const set =
      completionByQuest.get(completion.side_quest_id) ?? new Set<string>();
    set.add(completion.user_id);
    completionByQuest.set(completion.side_quest_id, set);
  }
  const nameById = new Map((staff ?? []).map((user) => [user.id, user.name]));
  const xpLeaderboard = (
    (xpWallets ?? []) as {
      user_id: string;
      quarter_start: string;
      quarterly_balance: number;
    }[]
  )
    .filter((wallet) => wallet.quarter_start === quarterStart)
    .map((wallet) => ({
      ...wallet,
      name: nameById.get(wallet.user_id) ?? "Staff member",
    }));
  const completersByQuest = new Map<string, string[]>();
  for (const completion of completions ?? [])
    completersByQuest.set(completion.side_quest_id, [
      ...(completersByQuest.get(completion.side_quest_id) ?? []),
      nameById.get(completion.user_id) ?? "Staff",
    ]);
  const currentStaff = staff?.find((user) => user.id === session.user.id);
  const isEligible = (quest: {
    audience_type: string;
    audience_filters: string[];
  }) =>
    quest.audience_type === "company" ||
    (quest.audience_type === "department" &&
      Boolean(
        currentStaff?.department &&
        quest.audience_filters.includes(currentStaff.department),
      )) ||
    (quest.audience_type === "location" &&
      Boolean(
        currentStaff?.location &&
        quest.audience_filters.includes(currentStaff.location),
      )) ||
    (quest.audience_type === "manager_group" &&
      Boolean(
        currentStaff?.manager_id &&
        quest.audience_filters.includes(currentStaff.manager_id),
      )) ||
    (quest.audience_type === "staff" &&
      quest.audience_filters.includes(session.user.id));
  const eligibleCount = (quest: {
    audience_type: string;
    audience_filters: string[];
  }) =>
    (staff ?? []).filter(
      (user) =>
        quest.audience_type === "company" ||
        (quest.audience_type === "department" &&
          Boolean(
            user.department && quest.audience_filters.includes(user.department),
          )) ||
        (quest.audience_type === "location" &&
          Boolean(
            user.location && quest.audience_filters.includes(user.location),
          )) ||
        (quest.audience_type === "manager_group" &&
          Boolean(
            user.manager_id && quest.audience_filters.includes(user.manager_id),
          )) ||
        (quest.audience_type === "staff" &&
          quest.audience_filters.includes(user.id)),
    ).length;
  const visibleQuests = questsWithLifecycle.filter(
    (quest) => canManage || isEligible(quest),
  );
  const now = new Date();
  const live = visibleQuests.filter(
    (quest) =>
      quest.status === "live" &&
      (!quest.starts_at || new Date(quest.starts_at) <= now) &&
      (!quest.ends_at || new Date(quest.ends_at) >= now),
  );
  const completedByYou = new Set(
    (completions ?? [])
      .filter(
        (item) =>
          item.user_id === session.user.id && item.status === "approved",
      )
      .map((item) => item.side_quest_id),
  );
  const yourCompletionStatus = new Map(
    (completions ?? [])
      .filter((item) => item.user_id === session.user.id)
      .map((item) => [item.side_quest_id, item.status]),
  );
  const audienceOptions = {
    departments: [
      ...new Set(
        (staff ?? [])
          .map((user) => user.department)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    locations: [
      ...new Set(
        (staff ?? [])
          .map((user) => user.location)
          .filter((value): value is string => Boolean(value)),
      ),
    ],
    managers: (staff ?? [])
      .filter((user) => ["admin", "hr", "manager"].includes(user.role))
      .map((user) => ({ id: user.id, name: user.name })),
    staff: (staff ?? []).map((user) => ({ id: user.id, name: user.name })),
  };
  const pendingReviews = canManage
    ? (completions ?? []).filter((item) => item.status === "pending")
    : [];
  const approvedCompletions = canManage
    ? (completions ?? []).filter((item) => item.status === "approved")
    : [];
  const rejectedCompletions = canManage
    ? (completions ?? []).filter((item) => item.status === "rejected")
    : [];
  const evidenceSubmitted = canManage
    ? (completions ?? []).filter(
        (item) =>
          item.evidence_note || item.evidence_url || item.evidence_file_url,
      )
    : [];
  const questById = new Map(
    questsWithLifecycle.map((quest) => [quest.id, quest]),
  );
  return (
    <>
      <SetPageHeader
        title="Side Quests"
        description="Short, purposeful challenges that turn culture into participation."
        icon="solar:cup-star-broken"
        trailing={
          canManage ? (
            <NewSideQuestButton options={audienceOptions} />
          ) : undefined
        }
      />
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            compact
            title="Live now"
            value={live.length}
            icon="solar:bolt-broken"
            color={live.length ? "orange" : "slate"}
            subtitle={live.length ? "Ready to join" : "Nothing running"}
          />
          <StatCard
            compact
            title="Your completions"
            value={completedByYou.size}
            icon="solar:check-circle-broken"
            color="green"
            subtitle="Across all quests"
          />
          <StatCard
            compact
            title="Team completions"
            value={(completions ?? []).length}
            icon="solar:users-group-rounded-broken"
            color="blue"
            subtitle="All challenges"
          />
          <StatCard
            compact
            title="Total quests"
            value={visibleQuests.length}
            icon="solar:cup-star-broken"
            color="amber"
            subtitle="Culture in action"
          />
        </section>
        {(achievements ?? []).length > 0 && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Icon icon="solar:cup-star-broken" className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Your achievements
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  Recognition unlocked through consistent Side Quest
                  participation.
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(
                achievements as {
                  id: string;
                  title: string;
                  description: string;
                  icon: string;
                }[]
              ).map((achievement) => (
                <div
                  key={achievement.id}
                  className="flex items-center gap-3 rounded-xl bg-[var(--surface-2)] p-3"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                    <Icon icon={achievement.icon} className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-hi)]">
                      {achievement.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">
                      {achievement.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        {canManage && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-5">
            <div className="mb-4 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                <Icon
                  icon="solar:graph-new-up-broken"
                  className="h-4.5 w-4.5"
                />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Approval and evidence report
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  Track verification workload and the quality of submitted quest
                  evidence.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                compact
                variant="inline"
                title="Awaiting review"
                value={pendingReviews.length}
                icon="solar:hourglass-broken"
                color="amber"
                subtitle="Needs an approver"
              />
              <StatCard
                compact
                variant="inline"
                title="Approved"
                value={approvedCompletions.length}
                icon="solar:check-circle-broken"
                color="green"
                subtitle="Verified completions"
              />
              <StatCard
                compact
                variant="inline"
                title="Evidence attached"
                value={evidenceSubmitted.length}
                icon="solar:paperclip-broken"
                color="blue"
                subtitle="Notes, links or files"
              />
              <StatCard
                compact
                variant="inline"
                title="Rejected"
                value={rejectedCompletions.length}
                icon="solar:close-circle-broken"
                color="red"
                subtitle="Need a retry"
              />
            </div>
          </section>
        )}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <Icon
                  icon="solar:medal-ribbon-broken"
                  className="h-4.5 w-4.5"
                />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Quarterly XP leaderboard
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  Recognition progress resets each quarter and never spends from
                  reward points.
                </p>
              </div>
            </div>
            <span className="rounded-lg bg-[var(--surface-2)] px-2 py-1 font-mono text-[11px] font-semibold text-[var(--text-lo)]">
              This quarter
            </span>
          </div>
          {xpLeaderboard.length ? (
            <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {xpLeaderboard.map((entry, index) => (
                <li
                  key={entry.user_id}
                  className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold ${index === 0 ? "bg-amber-500 text-white" : "bg-[var(--surface)] text-[var(--text-lo)]"}`}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold text-[var(--text-hi)]">
                    {entry.name}
                  </span>
                  <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-300">
                    {entry.quarterly_balance} XP
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 rounded-xl bg-[var(--surface-2)] px-3 py-4 text-center text-xs text-[var(--text-lo)]">
              Complete an XP-enabled Side Quest to start this quarter’s
              leaderboard.
            </p>
          )}
        </section>
        {canManage && pendingReviews.length > 0 && (
          <section className="rounded-2xl border border-amber-500/20 bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <Icon icon="solar:clipboard-check-broken" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Completion review
                </h2>
                <p className="text-xs text-[var(--text-lo)]">
                  Approve verified work to award quest points.
                </p>
              </div>
            </div>
            <div className="mt-4 divide-y divide-[var(--border)]">
              {pendingReviews.map((completion) => {
                const quest = questById.get(completion.side_quest_id);
                return (
                  <div
                    key={`${completion.side_quest_id}-${completion.user_id}`}
                    className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-hi)]">
                        {nameById.get(completion.user_id) ?? "Staff member"}{" "}
                        <span className="font-normal text-[var(--text-lo)]">
                          · {quest?.title ?? "Side Quest"}
                        </span>
                      </p>
                      {completion.evidence_note && (
                        <p className="mt-1 text-sm text-[var(--text-lo)]">
                          {completion.evidence_note}
                        </p>
                      )}
                      {completion.evidence_url && (
                        <a
                          className="mt-1 block truncate text-xs font-medium text-brand-500 hover:underline"
                          href={completion.evidence_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View evidence
                        </a>
                      )}
                      <p className="mt-1 text-xs text-[var(--text-lo)]">
                        Submitted{" "}
                        {new Date(completion.completed_at).toLocaleDateString(
                          "en-KE",
                          { day: "numeric", month: "short" },
                        )}
                      </p>
                    </div>
                    <QuestCompletionReviewButton
                      questId={completion.side_quest_id}
                      userId={completion.user_id}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        )}
        {live.length ? (
          <section className="grid gap-4 lg:grid-cols-2">
            {live.map((quest) => {
              const count = completionByQuest.get(quest.id)?.size ?? 0;
              return (
                <article
                  key={quest.id}
                  className="rounded-2xl border border-brand-500/15 bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                      <Icon icon="solar:cup-star-broken" className="h-5 w-5" />
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="rounded-md bg-brand-500/10 px-2 py-1 font-mono text-[10px] font-bold text-brand-600">
                        {quest.points} pts
                      </span>
                      <span className="rounded-md bg-brand-500/10 px-2 py-1 text-[10px] font-semibold text-brand-600">
                        Live
                      </span>
                      {canManage && (
                        <EditSideQuestButton
                          quest={quest}
                          options={audienceOptions}
                        />
                      )}
                    </div>
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-[var(--text-hi)]">
                    {quest.title}
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-lo)]">
                    {quest.brief}
                  </p>
                  <div className="mt-4 rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">
                      To complete
                    </p>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--text-hi)]">
                      {quest.completion_criteria}
                    </p>
                  </div>
                  {canManage &&
                    (completersByQuest.get(quest.id)?.length ?? 0) > 0 && (
                      <p className="mt-3 text-xs text-[var(--text-lo)]">
                        <span className="font-semibold text-[var(--text-hi)]">
                          Completed by:
                        </span>{" "}
                        {completersByQuest.get(quest.id)?.join(", ")}
                      </p>
                    )}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-[var(--text-lo)]">
                      <span className="font-semibold text-[var(--text-hi)]">
                        {count}
                      </span>{" "}
                      of {eligibleCount(quest)} completed ·{" "}
                      {audienceLabels[quest.audience_type]}
                      {quest.ends_at
                        ? ` · Ends ${new Date(quest.ends_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`
                        : ""}
                    </div>
                    <QuestCompletionButton
                      questId={quest.id}
                      status={yourCompletionStatus.get(quest.id)}
                      completionMode={quest.completion_mode}
                    />
                  </div>
                </article>
              );
            })}
          </section>
        ) : (
          <section className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
              <Icon icon="solar:cup-star-broken" className="h-6 w-6" />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-[var(--text-hi)]">
              No Side Quests are live
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-lo)]">
              When a challenge opens for your team, its brief and completion
              criteria will appear here.
            </p>
          </section>
        )}
        {visibleQuests.some((quest) => quest.status !== "live") && (
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon icon="solar:calendar-broken" className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                    Quest schedule
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                    What is planned next and the challenges already wrapped up.
                  </p>
                </div>
              </div>
              <span className="rounded-lg bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[11px] font-semibold text-[var(--text-lo)]">
                {
                  visibleQuests.filter((quest) => quest.status !== "live")
                    .length
                }{" "}
                quests
              </span>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {visibleQuests
                .filter((quest) => quest.status !== "live")
                .map((quest) => (
                  <article
                    key={quest.id}
                    className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-500/25 hover:shadow-2xl dark:shadow-black/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${quest.status === "upcoming" ? "bg-blue-500/10 text-blue-700 dark:text-blue-400" : quest.status === "closed" ? "bg-slate-500/10 text-slate-600 dark:text-slate-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}
                          >
                            {quest.status}
                          </span>
                          <span className="text-xs text-[var(--text-lo)]">
                            {audienceLabels[quest.audience_type]}
                          </span>
                        </div>
                        <h3 className="mt-2 truncate text-sm font-semibold text-[var(--text-hi)]">
                          {quest.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-lo)]">
                          {quest.brief}
                        </p>
                      </div>
                      {canManage && (
                        <EditSideQuestButton
                          quest={quest}
                          options={audienceOptions}
                        />
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-3 text-xs text-[var(--text-lo)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Icon
                          icon="solar:star-broken"
                          className="h-3.5 w-3.5 text-brand-500"
                        />
                        {quest.points} pts
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Icon
                          icon="solar:users-group-rounded-broken"
                          className="h-3.5 w-3.5"
                        />
                        {completionByQuest.get(quest.id)?.size ?? 0}/
                        {eligibleCount(quest)} completed
                      </span>
                      {(quest.starts_at || quest.ends_at) && (
                        <span className="inline-flex items-center gap-1.5">
                          <Icon
                            icon="solar:calendar-broken"
                            className="h-3.5 w-3.5"
                          />
                          {quest.status === "upcoming" && quest.starts_at
                            ? `Starts ${new Date(quest.starts_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`
                            : quest.ends_at
                              ? `Ended ${new Date(quest.ends_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`
                              : "Scheduled"}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
