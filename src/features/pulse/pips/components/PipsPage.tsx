import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { hasRole } from "@/lib/rbac";
import Link from "next/link";
import { NewPipButton } from "./NewPipButton";
import type { Pip } from "@/types/database";

async function getPips(userId: string, isManager: boolean) {
  if (isManager) {
    const { data } = await supabaseAdmin
      .from("pips")
      .select("*")
      .or(`user_id.eq.${userId},manager_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    return (data ?? []) as unknown as Pip[];
  }
  const { data } = await supabaseAdmin
    .from("pips")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as Pip[];
}

async function getDirectReports(managerId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name")
    .eq("manager_id", managerId)
    .eq("is_active", true);
  return (data ?? []) as { id: string; name: string }[];
}

export default async function PipsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { id: userId, role } = session.user;
  const isManager = hasRole(role, "manager");

  const [pips, directReports] = await Promise.all([
    getPips(userId, isManager),
    isManager ? getDirectReports(userId) : Promise.resolve([]),
  ]);

  const myPips = pips.filter((p) => p.user_id === userId);
  const teamPips = pips.filter((p) => p.manager_id === userId);

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance Improvement Plans</h1>
          <p className="text-sm text-slate-500 mt-1">Structured support for performance challenges</p>
        </div>
        {isManager && directReports.length > 0 && (
          <NewPipButton directReports={directReports} managerId={userId} />
        )}
      </div>

      {myPips.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">My PIPs</h2>
          <div className="space-y-2">
            {myPips.map((pip) => <PipRow key={pip.id} pip={pip} />)}
          </div>
        </section>
      )}

      {teamPips.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Team PIPs</h2>
          <div className="space-y-2">
            {teamPips.map((pip) => <PipRow key={pip.id} pip={pip} />)}
          </div>
        </section>
      )}

      {pips.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-500">No PIPs active.</p>
          {isManager && (
            <p className="text-xs text-slate-400 mt-1">Use a PIP to document performance concerns and support plans.</p>
          )}
        </div>
      )}
    </div>
  );
}

function PipRow({ pip }: { pip: Pip }) {
  const done = pip.actions.filter((a) => a.done).length;
  const total = pip.actions.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isResolved = !!pip.resolved_at;

  return (
    <Link href={`/pulse/pips/${pip.id}`}
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{pip.concern}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          Started {new Date(pip.start_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
          {pip.review_date && ` · Review ${new Date(pip.review_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}`}
        </p>
      </div>
      {total > 0 && (
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-400">{done}/{total}</span>
        </div>
      )}
      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isResolved ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
      }`}>
        {isResolved ? "Resolved" : "Active"}
      </span>
    </Link>
  );
}
