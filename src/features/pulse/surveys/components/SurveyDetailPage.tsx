import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { SurveyResponseForm } from "./SurveyResponseForm";
import { SurveyResults } from "./SurveyResults";
import type { Survey, SurveyResponse } from "@/types/database";

export default async function SurveyDetailPage({ surveyId }: { surveyId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data } = await supabaseAdmin.from("surveys").select("*").eq("id", surveyId).single();
  if (!data) notFound();
  const survey = data as unknown as Survey;

  const isAdmin = hasRole(session.user.role, "hr");

  // Check if user already responded
  const { data: myResponse } = await supabaseAdmin
    .from("survey_responses")
    .select("id")
    .eq("survey_id", surveyId)
    .eq("respondent_id", session.user.id)
    .maybeSingle();

  const alreadyResponded = !!myResponse;

  // Get responses for results (admins, or after survey closes)
  let responses: SurveyResponse[] = [];
  if (isAdmin || survey.status === "closed") {
    const { data: rData } = await supabaseAdmin
      .from("survey_responses")
      .select("*")
      .eq("survey_id", surveyId);
    responses = (rData ?? []) as unknown as SurveyResponse[];
  }

  const MIN_RESPONSES_FOR_RESULTS = 5;
  const showResults = (isAdmin || survey.status === "closed") &&
    (!survey.anonymous || responses.length >= MIN_RESPONSES_FOR_RESULTS);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold text-slate-900">{survey.title}</h1>
          {survey.anonymous && (
            <span className="rounded-full bg-slate-100 text-slate-500 px-2.5 py-0.5 text-xs">anonymous</span>
          )}
        </div>
        {survey.description && <p className="text-sm text-slate-500">{survey.description}</p>}
      </div>

      {/* Admin controls */}
      {isAdmin && <SurveyAdminBar survey={survey} responseCount={responses.length} />}

      {/* Take the survey */}
      {survey.status === "active" && !alreadyResponded && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Your Response</h2>
          <SurveyResponseForm
            surveyId={surveyId}
            questions={survey.questions}
            respondentId={survey.anonymous ? null : session.user.id}
          />
        </div>
      )}

      {survey.status === "active" && alreadyResponded && (
        <div className="rounded-xl bg-green-50 border border-green-100 p-4 text-sm text-green-700">
          ✓ You have already submitted a response. Thank you!
        </div>
      )}

      {/* Results */}
      {showResults ? (
        <SurveyResults survey={survey} responses={responses} />
      ) : survey.status === "closed" && survey.anonymous && responses.length < MIN_RESPONSES_FOR_RESULTS ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-500">
          Results are hidden — fewer than {MIN_RESPONSES_FOR_RESULTS} responses were submitted.
        </div>
      ) : null}
    </div>
  );
}

// Inline server component for admin bar
async function SurveyAdminBar({ survey, responseCount }: { survey: Survey; responseCount: number }) {
  return (
    <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 flex items-center justify-between">
      <p className="text-sm text-slate-600">
        <span className="font-semibold">{responseCount}</span> response{responseCount !== 1 ? "s" : ""} · Status: <span className="capitalize font-medium">{survey.status}</span>
      </p>
      <SurveyStatusToggle surveyId={survey.id} currentStatus={survey.status} />
    </div>
  );
}

import { SurveyStatusToggle } from "./SurveyStatusToggle";
