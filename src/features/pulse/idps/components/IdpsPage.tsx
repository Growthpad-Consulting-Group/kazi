import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { NewIdpButton } from "./NewIdpButton";
import type { Idp, IdpStatus } from "@/types/database";

const STATUS: Record<IdpStatus, { className: string; label: string }> = {
  active: { className: "bg-blue-500/10 text-blue-600", label: "Active" },
  completed: {
    className: "bg-emerald-500/10 text-emerald-600",
    label: "Completed",
  },
  cancelled: { className: "bg-slate-500/10 text-slate-500", label: "Closed" },
};

export default async function IdpsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const isManager = can(session.user.role, "manage_idps");
  const isHr = session.user.role === "admin" || session.user.role === "hr";
  const isEmployee = session.user.role === "employee";
  const filters = [
    `user_id.eq.${session.user.id}`,
    ...(isManager ? [`manager_id.eq.${session.user.id}`] : []),
  ];
  let plansQuery = supabaseAdmin
    .from("idps")
    .select("*")
    .order("created_at", { ascending: false });
  if (!isHr) plansQuery = plansQuery.or(filters.join(","));
  const { data } = await plansQuery;
  const plans = (data ?? []) as unknown as Idp[];
  const ids = [...new Set(plans.map((plan) => plan.user_id))];
  const peopleResult = ids.length
    ? await supabaseAdmin.from("users").select("id, name").in("id", ids)
    : { data: [] as { id: string; name: string }[] };
  const people = new Map(
    (peopleResult.data ?? []).map((person) => [person.id, person.name]),
  );
  const { data: directReportsData } = isManager
    ? isHr
      ? await supabaseAdmin
          .from("users")
          .select("id, name")
          .eq("is_active", true)
          .order("name")
      : await supabaseAdmin
          .from("users")
          .select("id, name")
          .eq("is_active", true)
          .eq("manager_id", session.user.id)
          .order("name")
    : { data: [] };
  const active = plans.filter((plan) => plan.status === "active");
  const complete = plans.filter((plan) => plan.status === "completed");
  const openActions = plans.reduce(
    (total, plan) =>
      total + plan.actions.filter((action) => !action.done).length,
    0,
  );
  const overdue = active.filter(
    (plan) =>
      plan.due_date && new Date(`${plan.due_date}T12:00:00`) < new Date(),
  ).length;

  return (
    <>
      <SetPageHeader
        title={isEmployee ? "My development plan" : "Development plans"}
        description={`${active.length} active plan${active.length === 1 ? "" : "s"} · ${openActions} open action item${openActions === 1 ? "" : "s"}`}
        icon="solar:book-broken"
        trailing={
          <NewIdpButton
            userId={session.user.id}
            isManager={isManager}
            directReports={(directReportsData ?? []).filter(
              (person) => person.id !== session.user.id,
            )}
            size="sm"
          />
        }
      />
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            title="Active plans"
            value={active.length}
            icon="solar:book-broken"
            color="blue"
            compact
            subtitle="Growth in motion"
          />
          <StatCard
            title="Open actions"
            value={openActions}
            icon="solar:checklist-minimalistic-broken"
            color={openActions ? "amber" : "green"}
            compact
            subtitle={
              openActions ? "Next steps to take" : "All actions complete"
            }
          />
          <StatCard
            title="Completed"
            value={complete.length}
            icon="solar:check-circle-broken"
            color="green"
            compact
            subtitle={`${plans.length ? Math.round((complete.length / plans.length) * 100) : 0}% of all plans`}
          />
          <StatCard
            title="Past target"
            value={overdue}
            icon="solar:calendar-mark-broken"
            color={overdue ? "red" : "slate"}
            compact
            subtitle={overdue ? "Plans need a review" : "Nothing overdue"}
          />
        </section>
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
                <Icon icon="solar:book-broken" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Growth plans
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  Goals, skill building, and the actions that turn intent into
                  progress.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
              {plans.length} total
            </span>
          </div>
          {plans.length ? (
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  owner={
                    plan.user_id === session.user.id
                      ? "My plan"
                      : (people.get(plan.user_id) ?? "Team member")
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState />
          )}
        </section>
      </div>
    </>
  );
}

function PlanCard({ plan, owner }: { plan: Idp; owner: string }) {
  const actions = plan.actions.length;
  const done = plan.actions.filter((action) => action.done).length;
  const open = actions - done;
  const progress = actions ? Math.round((done / actions) * 100) : 0;
  const meta = STATUS[plan.status];
  return (
    <Link
      href={`/pulse/idps/${plan.id}`}
      className="group rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 transition-colors hover:bg-[var(--surface)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
            {plan.title}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-lo)]">
            {owner}
            {plan.start_date || plan.due_date
              ? ` · ${plan.start_date ? new Date(`${plan.start_date}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "Start TBC"} – ${plan.due_date ? new Date(`${plan.due_date}T12:00:00`).toLocaleDateString("en-KE", { day: "numeric", month: "short" }) : "no target"}`
              : ""}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${meta.className}`}
        >
          {meta.label}
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
          {done}/{actions}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-lo)]">
          {open
            ? `${open} action${open === 1 ? "" : "s"} to go`
            : "All actions complete"}
        </span>
        <Icon
          icon="solar:arrow-right-broken"
          className="h-4 w-4 text-[var(--text-lo)] transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </Link>
  );
}
function EmptyState() {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
        <Icon icon="solar:book-broken" className="h-5 w-5" />
      </span>
      <h2 className="mt-3 text-base font-semibold text-[var(--text-hi)]">
        No development plans yet
      </h2>
      <p className="mt-1 max-w-xs text-xs leading-relaxed text-[var(--text-lo)]">
        Create a plan to make a growth goal visible, supported, and easier to
        follow through on.
      </p>
    </div>
  );
}
