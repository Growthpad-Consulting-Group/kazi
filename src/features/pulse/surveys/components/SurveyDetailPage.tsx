import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { SurveyResponseForm } from "./SurveyResponseForm";
import { SurveyResults } from "./SurveyResults";
import { SurveyStatusToggle } from "./SurveyStatusToggle";
import type { Survey, SurveyResponse, SurveyStatus } from "@/types/database";

const STATUS: Record<SurveyStatus, { label: string; tone: string; icon: string }> = {
  draft: { label: "Draft", tone: "bg-slate-500/10 text-slate-600", icon: "solar:pen-new-square-broken" },
  active: { label: "Live", tone: "bg-emerald-500/10 text-emerald-700", icon: "solar:play-circle-broken" },
  closed: { label: "Closed", tone: "bg-slate-500/10 text-slate-600", icon: "solar:lock-keyhole-broken" },
};

function date(value: string) {
  return new Date(value).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
}

export default async function SurveyDetailPage({ surveyId }: { surveyId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data } = await supabaseAdmin.from("surveys").select("*").eq("id", surveyId).single();
  if (!data) notFound();
  const survey = data as unknown as Survey;
  const isAdmin = can(session.user.role, "manage_surveys");

  const { data: myResponse } = !survey.anonymous
    ? await supabaseAdmin.from("survey_responses").select("id").eq("survey_id", surveyId).eq("respondent_id", session.user.id).maybeSingle()
    : { data: null };
  const alreadyResponded = !!myResponse;

  let responses: SurveyResponse[] = [];
  if (isAdmin || survey.status === "closed") {
    const { data: responseData } = await supabaseAdmin.from("survey_responses").select("*").eq("survey_id", surveyId);
    responses = (responseData ?? []) as unknown as SurveyResponse[];
  }

  const minimumResponses = 5;
  const showResults = (isAdmin || survey.status === "closed") && (!survey.anonymous || responses.length >= minimumResponses);
  const status = STATUS[survey.status];
  const responseLabel = survey.anonymous ? "Responses are anonymous" : "Responses are identifiable";

  return (
    <>
      <SetPageHeader title={survey.title} description={`${status.label} · ${survey.questions.length} question${survey.questions.length === 1 ? "" : "s"}`} icon="solar:chat-round-dots-broken" />
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:px-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-500"><Icon icon="solar:chat-round-dots-broken" className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="truncate text-lg font-semibold text-[var(--text-hi)] sm:text-xl">{survey.title}</h1><span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${status.tone}`}><Icon icon={status.icon} className="h-3 w-3" />{status.label}</span>{survey.anonymous && <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--text-lo)]"><Icon icon="solar:incognito-broken" className="h-3 w-3" />Anonymous</span>}</div>{survey.description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[var(--text-lo)]">{survey.description}</p>}</div></div>
            <Link href="/pulse/surveys" className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)]"><Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />All surveys</Link>
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0 space-y-5">
            {isAdmin && <section className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Icon icon="solar:chart-square-broken" className="h-4 w-4" /></span><div><p className="text-sm font-semibold text-[var(--text-hi)]">Survey controls</p><p className="mt-0.5 text-xs text-[var(--text-lo)]"><span className="font-semibold text-[var(--text-hi)]">{responses.length}</span> response{responses.length === 1 ? "" : "s"} collected so far</p></div></div><SurveyStatusToggle surveyId={survey.id} currentStatus={survey.status} /></section>}

            {survey.status === "active" && !alreadyResponded && <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="border-b border-[var(--border)] px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500"><Icon icon="solar:pen-new-square-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Your response</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Take a moment to answer honestly. Your perspective matters.</p></div></div></div><div className="p-5 sm:p-6"><SurveyResponseForm surveyId={surveyId} questions={survey.questions} respondentId={survey.anonymous ? null : session.user.id} /></div></section>}

            {survey.status === "active" && alreadyResponded && <section className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600"><Icon icon="solar:check-circle-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Response submitted</h2><p className="mt-1 text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">Thank you for sharing your perspective. Your response has been recorded.</p></div></section>}

            {survey.status === "draft" && <section className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-500/10 text-slate-500"><Icon icon="solar:pen-new-square-broken" className="h-5 w-5" /></span><h2 className="mt-3 text-sm font-semibold text-[var(--text-hi)]">This survey is still being prepared</h2><p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-lo)]">Responses will open when the survey is launched.</p></section>}

            {showResults ? <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6"><SurveyResults survey={survey} responses={responses} /></section> : survey.status === "closed" && survey.anonymous && responses.length < minimumResponses ? <section className="flex items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-700"><Icon icon="solar:eye-closed-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Results are protected</h2><p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">Anonymous results stay hidden until at least {minimumResponses} people respond. This survey received {responses.length}.</p></div></section> : null}
          </main>

          <aside className="space-y-4"><section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:clipboard-list-broken" className="h-4 w-4" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">Survey at a glance</h2></div><div className="mt-4 space-y-2"><Meta label="Questions" value={`${survey.questions.length} total`} icon="solar:question-circle-broken" /><Meta label="Privacy" value={responseLabel} icon={survey.anonymous ? "solar:incognito-broken" : "solar:user-id-broken"} /><Meta label="Created" value={date(survey.created_at)} icon="solar:calendar-broken" />{survey.opens_at && <Meta label="Opens" value={date(survey.opens_at)} icon="solar:calendar-add-broken" />}{survey.closes_at && <Meta label="Closes" value={date(survey.closes_at)} icon="solar:calendar-mark-broken" />}</div></section>{isAdmin && <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[var(--text-hi)]">Response health</p><p className="mt-0.5 text-[11px] text-[var(--text-lo)]">Participation so far</p></div><span className="font-mono text-xl font-bold text-[#f05d23]">{responses.length}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[#f05d23] to-orange-400" style={{ width: `${Math.min(100, responses.length * 10)}%` }} /></div><p className="mt-2 text-xs text-[var(--text-lo)]">{survey.anonymous ? `At least ${minimumResponses} responses unlock results.` : "Results are visible to administrators."}</p></section>}</aside>
        </div>
      </div>
    </>
  );
}

function Meta({ label, value, icon }: { label: string; value: string; icon: string }) {
  return <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2"><Icon icon={icon} className="h-4 w-4 shrink-0 text-[var(--text-lo)]" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">{label}</p><p className="truncate text-xs font-medium text-[var(--text-hi)]">{value}</p></div></div>;
}
