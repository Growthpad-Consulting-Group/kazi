import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { getOneOnOnes } from "../actions";
import { NewOneOnOneButton } from "./NewOneOnOneButton";
import Link from "next/link";
import type { OneOnOne } from "@/types/database";

type UserRow = { id: string; name: string; job_title: string | null };

export default async function OneOnOnesPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = session.user.id;
  const isManager = hasRole(session.user.role, "manager");

  const [sessions, reports] = await Promise.all([
    getOneOnOnes(isManager ? { managerId: userId } : { reportId: userId }),
    isManager
      ? supabaseAdmin
          .from("users")
          .select("id, name, job_title")
          .eq("manager_id", userId)
          .then((r) => (r.data ?? []) as unknown as UserRow[])
      : Promise.resolve<UserRow[]>([]),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">1-on-1s</h1>
          <p className="mt-1 text-sm text-slate-500">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</p>
        </div>
        {isManager && reports.length > 0 && (
          <NewOneOnOneButton managerId={userId} reports={reports} />
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="text-sm text-slate-400">No 1-on-1s yet.</p>
          {isManager && <p className="text-xs text-slate-400 mt-1">Schedule one with a direct report above.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
          {(sessions as OneOnOne[]).map((s, i) => (
            <Link
              key={s.id}
              href={`/pulse/one-on-ones/${s.id}`}
              className={`flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {s.scheduled_at
                    ? new Date(s.scheduled_at).toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                    : "Unscheduled"}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {s.action_items.length} action item{s.action_items.length !== 1 ? "s" : ""}
                  {s.action_items.filter((a) => !a.done).length > 0
                    ? ` · ${s.action_items.filter((a) => !a.done).length} open`
                    : ""}
                </p>
              </div>
              <span className="text-slate-300 text-sm">→</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
