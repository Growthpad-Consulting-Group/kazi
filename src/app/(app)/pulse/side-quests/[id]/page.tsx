import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { Accordion } from "@/components/ui/Accordion";
import { QuestCompletionButton } from "@/features/pulse/side-quests/components/QuestCompletionButton";
import { effectiveSideQuestStatus } from "@/lib/side-quest-lifecycle";

const audienceLabels: Record<string, string> = {
  company: "Company-wide",
  department: "Department",
  location: "Location",
  manager_group: "Manager group",
  staff: "Selected staff",
};

function formatDate(value: string | null) {
  if (!value) return "Open-ended";
  const normalized = value.includes("T") ? value : `${value}T12:00:00`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return "Open-ended";
  return date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const canManage = userCan(session.user, "manage_side_quests");
  const [{ data: questData }, { data: currentStaff }, { data: completions }] =
    await Promise.all([
      supabaseAdmin.from("side_quests").select("*").eq("id", id).maybeSingle(),
      supabaseAdmin
        .from("users")
        .select("id, department, location, manager_id")
        .eq("id", session.user.id)
        .maybeSingle(),
      supabaseAdmin
        .from("side_quest_completions")
        .select("user_id, status")
        .eq("side_quest_id", id),
    ]);

  if (!questData) notFound();
  const quest = {
    ...questData,
    status: effectiveSideQuestStatus(questData),
  };
  const filters = quest.audience_filters ?? [];
  const eligible =
    quest.audience_type === "company" ||
    (quest.audience_type === "department" &&
      !!currentStaff?.department &&
      filters.includes(currentStaff.department)) ||
    (quest.audience_type === "location" &&
      !!currentStaff?.location &&
      filters.includes(currentStaff.location)) ||
    (quest.audience_type === "manager_group" &&
      !!currentStaff?.manager_id &&
      filters.includes(currentStaff.manager_id)) ||
    (quest.audience_type === "staff" && filters.includes(session.user.id));
  // The engagement calendar is a shared planning surface: every authenticated
  // staff member can review a quest, including past department-targeted work.
  // Eligibility only governs whether someone can submit a completion.
  const canParticipate = canManage || eligible;

  const approved = (completions ?? []).filter(
    (completion) => completion.status === "approved",
  ).length;
  const pending = (completions ?? []).filter(
    (completion) => completion.status === "pending",
  ).length;
  const ownStatus = (completions ?? []).find(
    (completion) => completion.user_id === session.user.id,
  )?.status as "pending" | "approved" | "rejected" | undefined;

  return (
    <>
      <SetPageHeader
        title={quest.title}
        description="Side Quest"
        icon="solar:cup-star-broken"
        trailing={
          <Link
            href="/pulse/side-quests"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />
            All Side Quests
          </Link>
        }
      />
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
                  <Icon icon="solar:cup-star-broken" className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-hi)]">
                    Side Quest
                  </p>
                  <p className="text-xs text-[var(--text-lo)]">
                    A focused challenge for meaningful team participation.
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-brand-500 px-2.5 py-1 font-mono text-[10px] font-bold text-white">
                  {quest.points} pts
                </span>
                <span className="rounded-lg bg-brand-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-500">
                  {quest.status}
                </span>
                <span className="text-xs text-[var(--text-lo)]">
                  {audienceLabels[quest.audience_type] ?? "Side Quest"}
                </span>
              </div>
              <h1 className="mt-4 text-xl font-semibold tracking-tight text-[var(--text-hi)] sm:text-2xl">
                {quest.title}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-[var(--text-lo)]">
                {quest.brief}
              </p>
            </div>
            {quest.status === "live" && canParticipate && (
              <QuestCompletionButton
                questId={quest.id}
                questTitle={quest.title}
                completionCriteria={quest.completion_criteria}
                status={ownStatus}
                completionMode={quest.completion_mode}
              />
            )}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            compact
            variant="inline"
            title="Reward"
            value={`${quest.points} pts`}
            icon="solar:star-broken"
            color="orange"
            subtitle="On approval"
          />
          <StatCard
            compact
            variant="inline"
            title="Completed"
            value={approved}
            icon="solar:check-circle-broken"
            color="green"
            subtitle="Team progress"
          />
          <StatCard
            compact
            variant="inline"
            title="Awaiting review"
            value={pending}
            icon="solar:clock-circle-broken"
            color="amber"
            subtitle="Evidence submitted"
          />
          <StatCard
            compact
            variant="inline"
            title="Ends"
            value={
              quest.ends_at
                ? formatDate(quest.ends_at).replace(/, \d{4}$/, "")
                : "—"
            }
            icon="solar:calendar-broken"
            color="blue"
            subtitle={quest.ends_at ? "Closing date" : "No closing date"}
          />
        </section>

        <Accordion
          title="Completion brief"
          subtitle="Review the requirements before submitting your work"
          icon="solar:checklist-minimalistic-broken"
          defaultOpen
          className="shadow-xl shadow-slate-200/40 dark:shadow-black/20"
        >
          <p className="text-sm leading-relaxed text-[var(--text-hi)]">
            {quest.completion_criteria}
          </p>
        </Accordion>

        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 transition-colors hover:border-brand-500/25 dark:shadow-black/20">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Icon icon="solar:calendar-broken" className="h-4 w-4" />
            </span>
            <p className="mt-3 text-xs font-semibold text-brand-500">
              Schedule
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-hi)]">
              {formatDate(quest.starts_at)}
              {quest.ends_at ? ` – ${formatDate(quest.ends_at)}` : ""}
            </p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 transition-colors hover:border-brand-500/25 dark:shadow-black/20">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
              <Icon icon="solar:shield-check-broken" className="h-4 w-4" />
            </span>
            <p className="mt-3 text-xs font-semibold text-brand-500">
              Participation
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--text-hi)]">
              {quest.completion_mode === "self_confirm"
                ? "Self-confirmed completion"
                : quest.completion_mode === "evidence_required"
                  ? "Evidence required"
                  : "Manager review required"}
            </p>
          </article>
        </section>
      </div>
    </>
  );
}
