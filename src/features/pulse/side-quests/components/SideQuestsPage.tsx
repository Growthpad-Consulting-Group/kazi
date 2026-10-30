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
  const [{ data: quests }, { data: completions }, { data: staff }] =
    await Promise.all([
      supabaseAdmin
        .from("side_quests")
        .select("*")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("side_quest_completions")
        .select(
          "side_quest_id, user_id, status, evidence_note, evidence_url, completed_at",
        ),
      supabaseAdmin
        .from("users")
        .select("id, name, role, department, location, manager_id")
        .eq("is_active", true)
        .order("name"),
    ]);
  const completionByQuest = new Map<string, Set<string>>();
  for (const completion of completions ?? []) {
    if (completion.status !== "approved") continue;
    const set =
      completionByQuest.get(completion.side_quest_id) ?? new Set<string>();
    set.add(completion.user_id);
    completionByQuest.set(completion.side_quest_id, set);
  }
  const nameById = new Map((staff ?? []).map((user) => [user.id, user.name]));
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
  const visibleQuests = (quests ?? []).filter(
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
  const questById = new Map((quests ?? []).map((quest) => [quest.id, quest]));
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
                      {canManage && (
                        <EditSideQuestButton
                          quest={quest}
                          options={audienceOptions}
                        />
                      )}
                      <span className="rounded-md bg-brand-500/10 px-2 py-1 font-mono text-[10px] font-bold text-brand-600">
                        {quest.points} pts
                      </span>
                      <span className="rounded-md bg-brand-500/10 px-2 py-1 text-[10px] font-semibold text-brand-600">
                        Live
                      </span>
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
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">
              Planned and closed
            </h2>
            <div className="mt-3 divide-y divide-[var(--border)]">
              {visibleQuests
                .filter((quest) => quest.status !== "live")
                .map((quest) => (
                  <div
                    key={quest.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[var(--text-hi)]">
                        {quest.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                        {audienceLabels[quest.audience_type]} · {quest.status}
                      </p>
                      {canManage &&
                        (completersByQuest.get(quest.id)?.length ?? 0) > 0 && (
                          <p className="mt-3 text-xs text-[var(--text-lo)]">
                            <span className="font-semibold text-[var(--text-hi)]">
                              Completed by:
                            </span>{" "}
                            {completersByQuest.get(quest.id)?.join(", ")}
                          </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-[var(--text-lo)]">
                        {quest.points} pts ·{" "}
                        {completionByQuest.get(quest.id)?.size ?? 0} completed
                      </span>
                      {canManage && (
                        <EditSideQuestButton
                          quest={quest}
                          options={audienceOptions}
                        />
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
