import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";

function getCurrentWeekStart(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function PulseDashboard() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const userId = session.user.id;
  const isManager = hasRole(session.user.role, "manager");
  const weekStart = getCurrentWeekStart();

  // My check-in this week
  const [myCheckinRes, goalsRes] = await Promise.all([
    supabaseAdmin.from("checkins").select("id, status, mood").eq("user_id", userId).eq("week_start", weekStart).maybeSingle(),
    supabaseAdmin.from("goals").select("id, status").eq("owner_id", userId),
  ]);

  const myCheckin = myCheckinRes.data as { id: string; status: string; mood: number | null } | null;
  const myGoals = (goalsRes.data ?? []) as { id: string; status: string }[];
  const openGoals = myGoals.filter((g) => !["completed", "cancelled"].includes(g.status)).length;

  // Manager stats
  let teamStats: { total: number; submitted: number; avgMood: number | null } | null = null;
  if (isManager) {
    const reportsRes = await supabaseAdmin.from("users").select("id").eq("manager_id", userId);
    const ids = (reportsRes.data ?? []).map((r) => r.id as string);
    if (ids.length) {
      const teamCheckins = await supabaseAdmin
        .from("checkins")
        .select("mood, status")
        .in("user_id", ids)
        .eq("week_start", weekStart);
      const tc = (teamCheckins.data ?? []) as { mood: number | null; status: string }[];
      const moods = tc.filter((c) => c.mood !== null).map((c) => c.mood as number);
      teamStats = {
        total: ids.length,
        submitted: tc.filter((c) => ["submitted", "reviewed"].includes(c.status)).length,
        avgMood: moods.length > 0 ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length) * 10) / 10 : null,
      };
    }
  }

  const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kazi Pulse</h1>
        <p className="mt-1 text-sm text-slate-500">Performance & wellbeing, week of {new Date(weekStart + "T12:00:00").toLocaleDateString("en-KE", { day: "numeric", month: "long" })}</p>
      </div>

      {/* My status row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="text-xs text-slate-500">My Check-in</p>
          {myCheckin ? (
            <div className="mt-1 flex items-center gap-2">
              {myCheckin.mood && <span className="text-2xl">{MOODS[myCheckin.mood - 1]}</span>}
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${myCheckin.status === "reviewed" ? "bg-green-100 text-green-700" : myCheckin.status === "submitted" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-500"}`}>
                {myCheckin.status}
              </span>
            </div>
          ) : (
            <p className="text-sm font-semibold text-amber-600 mt-1">Not submitted</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="text-xs text-slate-500">My Goals</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{openGoals}</p>
          <p className="text-xs text-slate-400">active</p>
        </div>

        {teamStats && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
            <p className="text-xs text-slate-500">Team Check-ins</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{teamStats.submitted}<span className="text-base font-normal text-slate-400">/{teamStats.total}</span></p>
            <p className="text-xs text-slate-400">
              {teamStats.avgMood !== null ? `Avg mood: ${MOODS[Math.round(teamStats.avgMood) - 1]} ${teamStats.avgMood}` : "No mood data"}
            </p>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Check-in", href: "/pulse/checkins", icon: "📋", alert: !myCheckin },
          { label: "Goals", href: "/pulse/goals", icon: "🎯" },
          { label: "1-on-1s", href: "/pulse/one-on-ones", icon: "💬" },
          { label: "Feedback", href: "/pulse/feedback", icon: "⭐" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 ${
              a.alert ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <span className="text-lg">{a.icon}</span>
            <span>{a.label}</span>
            {a.alert && <span className="ml-auto w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />}
          </Link>
        ))}
      </div>
    </div>
  );
}
