import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { getMyCheckins, getTeamCheckins } from "../actions";
import { CheckinForm } from "./CheckinForm";
import { TeamCheckins } from "./TeamCheckins";

function getCurrentWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function CheckinsPage({ userId: overrideUserId }: { userId?: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = session.user.id;
  const isManager = hasRole(session.user.role, "manager");
  const weekStart = getCurrentWeekStart();

  const [myCheckins, teamCheckins] = await Promise.all([
    getMyCheckins(overrideUserId ?? userId),
    isManager ? getTeamCheckins(userId) : Promise.resolve([]),
  ]);

  const thisWeek = myCheckins.find((c) => c.week_start === weekStart) ?? null;

  const weekLabel = new Date(weekStart + "T12:00:00").toLocaleDateString("en-KE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Weekly Check-in</h1>
        <p className="mt-1 text-sm text-slate-500">Week of {weekLabel}</p>
      </div>

      {/* My check-in */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-slate-700">My Check-in</h2>
          {thisWeek && (
            <StatusBadge status={thisWeek.status} />
          )}
        </div>
        <CheckinForm userId={overrideUserId ?? userId} weekStart={weekStart} existing={thisWeek} />
      </div>

      {/* Past check-ins */}
      {myCheckins.length > 1 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Past Check-ins
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {myCheckins.slice(1).map((c, i) => (
              <div
                key={c.id}
                className={`flex items-center justify-between px-5 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}
              >
                <span className="text-sm text-slate-700">
                  {new Date(c.week_start + "T12:00:00").toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <div className="flex items-center gap-3">
                  {c.mood && <span className="text-base">{["😔","😕","😐","🙂","😄"][c.mood - 1]}</span>}
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team check-ins for managers */}
      {isManager && teamCheckins.length > 0 && (
        <TeamCheckins checkins={teamCheckins} weekStart={weekStart} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-500",
    submitted: "bg-blue-100 text-blue-600",
    reviewed: "bg-green-100 text-green-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${styles[status] ?? "bg-slate-100 text-slate-500"}`}>
      {status}
    </span>
  );
}
