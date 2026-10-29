import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { NewPipButton } from "./NewPipButton";
import type { Pip } from "@/types/database";

const shortDate = (value: string) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });

export default async function PipsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const { id: userId, role } = session.user;
  const isManager = can(role, "manage_pips");
  const [pipsResult, reportsResult] = await Promise.all([
    isManager
      ? supabaseAdmin
          .from("pips")
          .select("*")
          .or(`user_id.eq.${userId},manager_id.eq.${userId}`)
          .order("created_at", { ascending: false })
      : supabaseAdmin
          .from("pips")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
    isManager
      ? supabaseAdmin
          .from("users")
          .select("id, name")
          .eq("manager_id", userId)
          .eq("is_active", true)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const pips = (pipsResult.data ?? []) as unknown as Pip[];
  const reports = (reportsResult.data ?? []) as { id: string; name: string }[];
  const names = new Map(reports.map((report) => [report.id, report.name]));
  const myPips = pips.filter((pip) => pip.user_id === userId);
  const teamPips = pips.filter(
    (pip) => pip.manager_id === userId && pip.user_id !== userId,
  );
  const active = pips.filter((pip) => !pip.resolved_at);
  const resolved = pips.filter((pip) => Boolean(pip.resolved_at));
  const dueForReview = active.filter(
    (pip) =>
      pip.review_date && new Date(`${pip.review_date}T12:00:00`) <= new Date(),
  ).length;
  const actionsOpen = active.reduce(
    (total, pip) => total + pip.actions.filter((action) => !action.done).length,
    0,
  );

  return (
    <>
      <SetPageHeader
        title="Performance support plans"
        description={`${active.length} active plan${active.length === 1 ? "" : "s"} · structured support and clear follow-through`}
        icon="solar:heart-pulse-broken"
        trailing={
          isManager && reports.length ? (
            <NewPipButton
              directReports={reports}
              managerId={userId}
              size="sm"
            />
          ) : undefined
        }
      />
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Active plans"
            value={active.length}
            icon="solar:heart-pulse-broken"
            color="amber"
            compact
            subtitle="Support in progress"
          />
          <StatCard
            title="Review due"
            value={dueForReview}
            icon="solar:calendar-mark-broken"
            color={dueForReview ? "red" : "green"}
            compact
            subtitle={dueForReview ? "Needs a check-in" : "Nothing due now"}
          />
          <StatCard
            title="Open actions"
            value={actionsOpen}
            icon="solar:checklist-minimalistic-broken"
            color={actionsOpen ? "blue" : "green"}
            compact
            subtitle="Across active plans"
          />
          <StatCard
            title="Resolved"
            value={resolved.length}
            icon="solar:check-circle-broken"
            color="green"
            compact
            subtitle={`${pips.length ? Math.round((resolved.length / pips.length) * 100) : 0}% of all plans`}
          />
        </section>
        {pips.length ? (
          <div className="grid gap-5 xl:grid-cols-2">
            <PipSection
              title="My support plans"
              description="Your agreed outcomes, support, and regular check-ins."
              pips={myPips}
              names={names}
            />
            <PipSection
              title="Team support plans"
              description="Support plans you are accountable for as a manager."
              pips={teamPips}
              names={names}
            />
          </div>
        ) : (
          <section className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 text-center shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Icon icon="solar:heart-pulse-broken" className="h-5 w-5" />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-[var(--text-hi)]">
              No support plans active
            </h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-lo)]">
              A support plan creates a fair, documented rhythm for agreed
              outcomes, coaching, and follow-through.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

function PipSection({
  title,
  description,
  pips,
  names,
}: {
  title: string;
  description: string;
  pips: Pip[];
  names: Map<string, string>;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-[var(--text-lo)]">{description}</p>
        </div>
        <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
          {pips.length}
        </span>
      </div>
      {pips.length ? (
        <div className="space-y-2 p-3">
          {pips.map((pip) => (
            <PipCard key={pip.id} pip={pip} name={names.get(pip.user_id)} />
          ))}
        </div>
      ) : (
        <p className="px-5 py-10 text-center text-xs text-[var(--text-lo)]">
          No plans in this group.
        </p>
      )}
    </section>
  );
}
function PipCard({ pip, name }: { pip: Pip; name?: string }) {
  const total = pip.actions.length;
  const done = pip.actions.filter((action) => action.done).length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const active = !pip.resolved_at;
  return (
    <Link
      href={`/pulse/pips/${pip.id}`}
      className="group block rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-colors hover:bg-[var(--surface)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold text-[var(--text-hi)]">
            {pip.concern}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-lo)]">
            {name ? `${name} · ` : ""}Started{" "}
            {new Date(`${pip.start_date}T12:00:00`).toLocaleDateString(
              "en-KE",
              { day: "numeric", month: "short" },
            )}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${active ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}
        >
          {active ? "Active" : "Resolved"}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="font-mono text-[10px] font-bold text-[var(--text-lo)]">
          {done}/{total}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-lo)]">{`${shortDate(pip.start_date)} – ${pip.review_date ? shortDate(pip.review_date) : "no review date"}`}</span>
        <Icon
          icon="solar:arrow-right-broken"
          className="h-4 w-4 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
