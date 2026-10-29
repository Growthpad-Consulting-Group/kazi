import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { AcknowledgeMilestoneButton } from "./AcknowledgeMilestoneButton";

type MilestoneRow = {
  id: string;
  user_id: string;
  type: string;
  milestone_date: string;
  years_count: number | null;
  user_name: string;
};

const TYPE_ICON: Record<string, string> = {
  work_anniversary: "solar:calendar-mark-broken",
  birthday: "solar:gift-broken",
  onboarding_complete: "solar:star-broken",
  service_achievement: "solar:medal-ribbon-broken",
};

const TYPE_LABEL: Record<string, string> = {
  work_anniversary: "Work anniversary",
  birthday: "Birthday",
  onboarding_complete: "Onboarding complete",
  service_achievement: "Service achievement",
};

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T12:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

export default async function MilestonesWidget() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_one_on_ones")) return null;

  const canManageAll = can(session.user.role, "manage_recognition_campaigns");
  const { data: reports } = canManageAll
    ? { data: [] as { id: string }[] }
    : await supabaseAdmin
        .from("users")
        .select("id")
        .eq("manager_id", session.user.id)
        .eq("is_active", true);
  if (!canManageAll && !reports?.length) return null;

  let query = supabaseAdmin
    .from("milestones")
    .select("id, user_id, type, milestone_date, years_count")
    .eq("acknowledged", false)
    .gte("milestone_date", todayStr)
    .order("milestone_date", { ascending: true })
    .limit(5);
  if (!canManageAll)
    query = query.in(
      "user_id",
      (reports ?? []).map((report) => report.id),
    );
  const { data } = await query;

  const rows = data ?? [];

  let milestones: MilestoneRow[] = [];
  if (rows.length) {
    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, name")
      .in("id", userIds);
    const nameMap = new Map((users ?? []).map((u) => [u.id, u.name]));
    milestones = rows.map((r) => ({
      ...r,
      user_name: nameMap.get(r.user_id) ?? "Team member",
    }));
  }

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
          <Icon icon="solar:confetti-broken" className="h-3.5 w-3.5" />
        </span>
        <h2 className="text-sm font-semibold text-[var(--text-hi)]">
          Upcoming milestones
        </h2>
      </div>

      {milestones.length === 0 ? (
        <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-4 text-center">
          <p className="text-xs text-[var(--text-lo)]">
            No upcoming milestones.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {milestones.map((milestone) => {
            const days = daysUntil(milestone.milestone_date);
            const icon = TYPE_ICON[milestone.type] ?? "solar:star-broken";
            const label = TYPE_LABEL[milestone.type] ?? milestone.type;
            const detail =
              milestone.type === "work_anniversary" && milestone.years_count
                ? `${milestone.years_count} year${milestone.years_count === 1 ? "" : "s"}`
                : null;

            return (
              <li
                key={milestone.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500">
                  <Icon icon={icon} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                    {milestone.user_name}
                  </p>
                  <p className="truncate text-xs text-[var(--text-lo)]">
                    {label}
                    {detail && ` — ${detail}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${days === 0 ? "bg-brand-500/10 text-brand-500" : "bg-[var(--surface)] text-[var(--text-lo)]"}`}
                  >
                    {days === 0 ? "Today" : `in ${days}d`}
                  </span>
                  <AcknowledgeMilestoneButton milestoneId={milestone.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
