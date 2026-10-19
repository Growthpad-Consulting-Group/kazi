import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { NewSurveyButton } from "./NewSurveyButton";
import type { Survey, SurveyStatus } from "@/types/database";

const STATUS_BADGE: Record<SurveyStatus, string> = {
  draft: "bg-slate-100 text-slate-500",
  active: "bg-green-100 text-green-700",
  closed: "bg-slate-200 text-slate-500",
};

export default async function SurveysPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = hasRole(session.user.role, "hr");
  const { data } = await supabaseAdmin.from("surveys").select("*").order("created_at", { ascending: false });
  const surveys = (data ?? []) as unknown as Survey[];

  const active = surveys.filter((s) => s.status === "active");

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Surveys</h1>
          <p className="mt-1 text-sm text-slate-500">
            {active.length > 0 ? <span className="text-green-600 font-medium">{active.length} active survey{active.length > 1 ? "s" : ""}</span> : "No active surveys"}
          </p>
        </div>
        {isAdmin && <NewSurveyButton userId={session.user.id} />}
      </div>

      {surveys.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-400">No surveys yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {surveys.map((s, i) => (
            <Link
              key={s.id}
              href={`/pulse/surveys/${s.id}`}
              className={`flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                  {s.anonymous && (
                    <span className="rounded-full bg-slate-100 text-slate-500 px-2 py-0.5 text-xs">anonymous</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{s.questions.length} question{s.questions.length !== 1 ? "s" : ""}</p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[s.status]}`}>
                {s.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
