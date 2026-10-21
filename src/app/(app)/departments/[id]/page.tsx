import Link from "next/link";
import { Icon } from "@iconify/react";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";

export default async function DepartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !hasRole(session.user.role, "manager")) notFound();
  const { id } = await params;
  const { data: department } = await supabaseAdmin.from("departments").select("id, name").eq("id", id).maybeSingle();
  if (!department) notFound();

  const [staffResult, jobsResult] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, email, job_title, role").eq("department", department.name).eq("is_active", true).order("name"),
    supabaseAdmin.from("jobs").select("id, title, status, location").eq("department", department.name).order("created_at", { ascending: false }),
  ]);
  const staff = staffResult.data ?? [];
  const jobs = jobsResult.data ?? [];
  const jobIds = jobs.map((job) => job.id);
  const staffIds = staff.map((person) => person.id);
  const [candidatesResult, goalsResult] = await Promise.all([
    jobIds.length ? supabaseAdmin.from("candidates").select("id, stage").in("job_id", jobIds) : Promise.resolve({ data: [] }),
    staffIds.length ? supabaseAdmin.from("goals").select("id, status").in("owner_id", staffIds) : Promise.resolve({ data: [] }),
  ]);
  const candidates = candidatesResult.data ?? [];
  const goals = goalsResult.data ?? [];
  const activeJobs = jobs.filter((job) => job.status === "open").length;
  const activePipeline = candidates.filter((candidate) => !["hired", "rejected"].includes(candidate.stage)).length;
  const goalsAtRisk = goals.filter((goal) => goal.status === "at_risk").length;

  return <div className="mx-auto max-w-7xl space-y-5"><SetPageHeader title={department.name} description="Department workspace across Staff, Hire and Pulse." icon="solar:buildings-broken" actions={[{ label: "Department settings", icon: "solar:settings-broken", href: "/settings/departments", variant: "secondary" }]} />
    <section className="relative overflow-hidden rounded-3xl border border-[#f05d23]/20 bg-gradient-to-br from-[#2b1108] via-[#1d1411] to-[var(--surface)] p-6 shadow-xl shadow-[#f05d23]/5"><div className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[#f05d23]/20 blur-3xl" /><div className="relative"><p className="text-xs font-semibold uppercase tracking-[.16em] text-orange-200/65">Department workspace</p><h1 className="mt-1 text-2xl font-bold text-white">{department.name}</h1><p className="mt-2 max-w-xl text-sm text-white/60">One operational view of the people, open roles and performance commitments in this department.</p></div></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="Active staff" value={staff.length} icon="solar:users-group-two-rounded-broken" color="orange" compact variant="flat" /><StatCard title="Open roles" value={activeJobs} icon="solar:case-round-broken" color="blue" compact variant="flat" /><StatCard title="In pipeline" value={activePipeline} icon="solar:sort-horizontal-broken" color="amber" compact variant="flat" /><StatCard title="Goals at risk" value={goalsAtRisk} icon="solar:danger-triangle-broken" color={goalsAtRisk ? "red" : "green"} compact variant="flat" /></section>
    <div className="grid gap-5 xl:grid-cols-2"><section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"><div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Staff</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">People working in {department.name}.</p></div><Link href="/people" className="text-xs font-semibold text-[#f05d23]">All staff</Link></div>{staff.length ? <div className="divide-y divide-[var(--border)]">{staff.slice(0, 8).map((person) => <Link key={person.id} href={`/people/${person.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f05d23]/10 text-xs font-bold text-[#f05d23]">{person.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--text-hi)]">{person.name}</span><span className="block truncate text-xs text-[var(--text-lo)]">{person.job_title ?? person.role.replaceAll("_", " ")}</span></span><Icon icon="solar:arrow-right-broken" className="h-4 w-4 text-[var(--text-lo)]" /></Link>)}</div> : <Empty label="No active staff assigned yet." icon="solar:users-group-two-rounded-broken" />}</section>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm"><div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Roles</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Hiring activity in this department.</p></div><Link href="/hire/jobs" className="text-xs font-semibold text-[#f05d23]">All jobs</Link></div>{jobs.length ? <div className="divide-y divide-[var(--border)]">{jobs.slice(0, 8).map((job) => <Link key={job.id} href={`/hire/jobs/${job.id}`} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-2)]"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500"><Icon icon="solar:case-round-broken" className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[var(--text-hi)]">{job.title}</span><span className="block truncate text-xs capitalize text-[var(--text-lo)]">{job.status}{job.location ? ` · ${job.location}` : ""}</span></span><Icon icon="solar:arrow-right-broken" className="h-4 w-4 text-[var(--text-lo)]" /></Link>)}</div> : <Empty label="No roles created for this department." icon="solar:case-round-broken" />}</section></div>
  </div>;
}

function Empty({ label, icon }: { label: string; icon: string }) { return <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center"><Icon icon={icon} className="h-5 w-5 text-[var(--text-lo)]" /><p className="mt-2 text-sm text-[var(--text-lo)]">{label}</p></div>; }
