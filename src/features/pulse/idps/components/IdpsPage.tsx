import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { NewIdpButton } from "./NewIdpButton";
import type { Idp, IdpStatus } from "@/types/database";

const STATUS_BADGE: Record<IdpStatus, string> = {
  active: "bg-blue-100 text-blue-600",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-400",
};

export default async function IdpsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isManager = hasRole(session.user.role, "manager");

  // My own IDPs + IDPs I manage
  const orClauses = [`user_id.eq.${session.user.id}`];
  if (isManager) orClauses.push(`manager_id.eq.${session.user.id}`);

  const { data } = await supabaseAdmin
    .from("idps")
    .select("*")
    .or(orClauses.join(","))
    .order("created_at", { ascending: false });

  const idps = (data ?? []) as unknown as Idp[];

  // Get user names
  const userIds = [...new Set(idps.map((i) => i.user_id))];
  const { data: usersData } = await supabaseAdmin.from("users").select("id, name").in("id", userIds);
  const users: Record<string, string> = Object.fromEntries(
    ((usersData ?? []) as unknown as { id: string; name: string }[]).map((u) => [u.id, u.name])
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Development Plans</h1>
          <p className="mt-1 text-sm text-slate-500">{idps.filter((i) => i.status === "active").length} active plan{idps.filter((i) => i.status === "active").length !== 1 ? "s" : ""}</p>
        </div>
        <NewIdpButton userId={session.user.id} isManager={isManager} />
      </div>

      {idps.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="text-sm text-slate-400">No development plans yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
          {idps.map((idp, i) => {
            const openActions = idp.actions.filter((a) => !a.done).length;
            return (
              <Link key={idp.id} href={`/pulse/idps/${idp.id}`}
                className={`flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{idp.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {idp.user_id !== session.user.id ? users[idp.user_id] ?? "—" : "My plan"}
                    {openActions > 0 ? ` · ${openActions} open action${openActions > 1 ? "s" : ""}` : ""}
                    {idp.due_date ? ` · due ${new Date(idp.due_date).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[idp.status]}`}>
                  {idp.status}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
