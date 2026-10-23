import Link from "next/link";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { getGoals } from "../actions";

type StaffProfile = { id: string; name: string; job_title: string | null; department: string | null; manager_id: string | null };

export default async function StaffGoalsPage({ userId }: { userId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const canManage = can(session.user.role, "manage_goals");
  const mayRequestProfile = canManage || userId === session.user.id;
  const { data } = mayRequestProfile ? await supabaseAdmin.from("users").select("id, name, job_title, department, manager_id").eq("id", userId).maybeSingle() : { data: null };
  const staff = data as StaffProfile | null;
  if (!staff) notFound();
  const canView = session.user.role === "admin" || session.user.role === "hr" || staff.manager_id === session.user.id || staff.id === session.user.id;
  if (!canView) notFound();
  const goals = await getGoals({ ownerId: staff.id });
  const active = goals.filter((goal) => !["completed", "cancelled"].includes(goal.status));
  const atRisk = active.filter((goal) => goal.status === "at_risk");
  const average = active.length ? Math.round(active.reduce((sum, goal) => sum + goal.progress, 0) / active.length) : 0;
  const firstName = staff.name.split(" ")[0];

  return <>
    <SetPageHeader title={staff.name + " · Goals"} description={(staff.job_title ?? "Staff member") + (staff.department ? " · " + staff.department : "")} icon="solar:target-broken" actions={[{ label: "Staff profile", icon: "solar:user-id-broken", variant: "secondary", href: "/staff/" + staff.id + "?tab=pulse" }]} />
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard variant="flat" compact title="Active goals" value={active.length} icon="solar:target-broken" color="orange" subtitle={goals.length + " total"} />
        <StatCard variant="flat" compact title="Average progress" value={average + "%"} icon="solar:chart-2-broken" color="blue" subtitle="Across active goals" />
        <StatCard variant="flat" compact title="At risk" value={atRisk.length} icon="solar:danger-triangle-broken" color={atRisk.length ? "amber" : "green"} subtitle={atRisk.length ? "Needs a conversation" : "Everything on track"} />
        <StatCard variant="flat" compact title="Completed" value={goals.filter((goal) => goal.status === "completed").length} icon="solar:check-circle-broken" color="green" subtitle="Finished outcomes" />
      </section>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Icon icon="solar:target-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Individual commitments</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Outcomes owned by {firstName}.</p></div></div>
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">{goals.length} total</span>
        </div>
        {goals.length ? <div className="grid gap-3 p-4 sm:grid-cols-2">{goals.map((goal) => <article key={goal.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4"><div className="flex items-start justify-between gap-3"><p className="min-w-0 flex-1 text-sm font-semibold text-[var(--text-hi)]">{goal.title}</p><span className="rounded-lg bg-[var(--surface)] px-2 py-1 text-[10px] font-semibold capitalize text-[var(--text-lo)]">{goal.status.replaceAll("_", " ")}</span></div><div className="mt-4 flex items-center justify-between text-xs"><span className="text-[var(--text-lo)]">Progress</span><span className="font-mono font-bold text-brand-500">{goal.progress}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--border)]"><div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-orange-400" style={{ width: goal.progress + "%" }} /></div></article>)}</div> : <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500"><Icon icon="solar:target-broken" className="h-5 w-5" /></span><h2 className="mt-3 text-sm font-semibold text-[var(--text-hi)]">No individual goals yet</h2><p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-lo)]">Goals assigned to {firstName} will appear here.</p></div>}
      </section>
      <Link href="/pulse/checkins?tab=goals" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500"><Icon icon="solar:arrow-left-broken" className="h-4 w-4" />All goals</Link>
    </div>
  </>;
}
