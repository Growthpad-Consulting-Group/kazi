import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@iconify/react";
import { getCandidate, getCandidateNotes, type NoteWithUser } from "../actions";
import { StageBadge } from "./StageBadge";
import { StageAdvancer } from "./StageAdvancer";
import { NoteForm } from "./NoteForm";
import { EmailPanel } from "./EmailPanel";
import OnboardCandidateButton from "./OnboardCandidateButton";
import DeleteCandidateButton from "./DeleteCandidateButton";
import {
  BookInterviewButton,
  InterviewActions,
  type ScheduledInterview,
} from "./BookInterviewButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import SetPageHeader from "@/components/ui/SetPageHeader";
import PageWithSidebar from "@/components/ui/PageWithSidebar";
import SidebarWidget from "@/components/ui/SidebarWidget";
import StatCard from "@/components/ui/StatCard";
import type { CandidateStage } from "../types";
import { supabaseAdmin } from "@/lib/supabase";
import { can } from "@/lib/rbac";
import { CandidateCvViewer } from "./CandidateCvViewer";

type CvParsed = {
  skills?: string[];
  experience?: { title: string; company: string; duration: string }[];
  education?: { degree: string; institution: string; year: string }[];
};
const STAGES: CandidateStage[] = [
  "applied",
  "screened",
  "interview",
  "offer",
  "hired",
];

export default async function CandidateDetailPage({ id }: { id: string }) {
  const candidateRecord = await getCandidate(id).catch(() => null);
  if (!candidateRecord) notFound();
  const candidate = {
    ...candidateRecord,
    cv_text: formatCvText(candidateRecord.cv_text),
  };
  const notes = await getCandidateNotes(id);
  const job = candidate.jobs;
  const cvParsed = candidate.cv_parsed as CvParsed | null;
  const hasCv = !!(
    candidate.cv_text ||
    candidate.cv_parsed ||
    candidate.cv_url
  );
  const screeningRubric = job?.scoring_rubric ?? [];
  const shortlistThreshold = 65;
  const { data: managersData } =
    candidate.stage === "hired" && !candidate.hired_user_id
      ? await supabaseAdmin
          .from("users")
          .select("id, name, job_title")
          .in("role", ["admin", "hr", "manager", "hiring_manager"])
          .eq("is_active", true)
          .order("name")
      : { data: [] };
  const { data: upcomingInterviews } =
    candidate.stage === "interview"
      ? await supabaseAdmin
          .from("candidate_interviews")
          .select("id, scheduled_at, duration_minutes")
          .eq("candidate_id", candidate.id)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at")
      : { data: [] };
  const interviews = (upcomingInterviews ?? []) as ScheduledInterview[];
  const session = await getServerSession(authOptions);
  const canManageHiring = Boolean(
    session && can(session.user.role, "manage_hiring"),
  );
  const canManageInterviews =
    candidate.stage === "interview" && canManageHiring;
  const { data: interviewerData } =
    candidate.stage === "interview"
      ? await supabaseAdmin
          .from("users")
          .select("id, name, job_title")
          .in("role", [
            "admin",
            "hr",
            "manager",
            "hiring_manager",
            "interviewer",
          ])
          .eq("is_active", true)
          .order("name")
      : { data: [] };
  const interviewers = (interviewerData ?? []) as {
    id: string;
    name: string;
    job_title: string | null;
  }[];

  const main = (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-orange-400 text-white shadow-lg shadow-brand-500/25">
            <Icon icon="solar:user-rounded-broken" className="h-7 w-7" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-[var(--text-hi)]">
                {candidate.full_name}
              </h2>
              <StageBadge stage={candidate.stage} />
            </div>
            <p className="mt-1 text-sm font-medium text-brand-500">
              {job?.title ?? "Unassigned role"}
              {job?.department ? ` · ${job.department}` : ""}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--text-lo)]">
              <ContactItem icon="solar:letter-broken" value={candidate.email} />
              <ContactItem icon="solar:phone-broken" value={candidate.phone} />
              <ContactItem
                icon="solar:map-point-broken"
                value={candidate.location}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          title="AI score"
          value={
            candidate.ai_score === null ? "—" : `${candidate.ai_score}/100`
          }
          icon="solar:magic-stick-3-broken"
          color="green"
          compact
          subtitle={candidate.shortlisted ? "Shortlisted" : "Awaiting decision"}
        />
        <StatCard
          title="Applied"
          value={new Date(candidate.applied_at).toLocaleDateString("en-KE", {
            day: "numeric",
            month: "short",
          })}
          icon="solar:calendar-broken"
          color="slate"
          compact
          subtitle="Application received"
        />
        <StatCard
          title="CV status"
          value={hasCv ? (cvParsed ? "Parsed" : "Ready") : "Missing"}
          icon="solar:document-text-broken"
          color={hasCv ? "blue" : "slate"}
          compact
          subtitle={
            cvParsed
              ? "Parsed for review"
              : hasCv
                ? "Ready for AI screening"
                : "No CV available"
          }
        />
        <StatCard
          title="Notes"
          value={notes.length}
          icon="solar:notes-broken"
          color="amber"
          compact
          subtitle={notes.length ? "Team context added" : "No notes yet"}
        />
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <SectionHeader
          icon="solar:sort-horizontal-broken"
          title="Hiring progress"
        />
        <p className="-mt-3 mb-4 text-xs text-[var(--text-lo)]">
          Update the stage as the candidate moves through your hiring process.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {STAGES.map((stage, index) => (
            <div key={stage} className="flex items-center gap-2">
              <StageAdvancer
                candidateId={candidate.id}
                stage={stage}
                current={candidate.stage}
              />
              {index < STAGES.length - 1 && (
                <Icon
                  icon="solar:alt-arrow-right-broken"
                  className="h-3.5 w-3.5 text-[var(--text-lo)]"
                />
              )}
            </div>
          ))}
          <span className="mx-1 h-5 w-px bg-[var(--border)]" />
          <StageAdvancer
            candidateId={candidate.id}
            stage="rejected"
            current={candidate.stage}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionHeader
              icon="solar:magic-stick-3-broken"
              title="AI screening scorecard"
            />
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Evidence from the CV, evaluated against this role&apos;s rubric.
            </p>
          </div>
          {candidate.ai_score !== null && (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${candidate.ai_score >= shortlistThreshold ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"}`}
            >
              {candidate.ai_score >= shortlistThreshold
                ? "Meets shortlist threshold"
                : `Below ${shortlistThreshold}-point threshold`}
            </span>
          )}
        </div>
        {candidate.ai_score !== null ? (
          <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
              <div className="rounded-2xl bg-[var(--surface-2)] p-4">
                <p className="text-sm capitalize font-semibold text-[var(--text-lo)]">
                  Overall fit
                </p>
                <div className="mt-2 flex items-end gap-2">
                  <span
                    className={`font-mono text-4xl font-bold ${candidate.ai_score >= shortlistThreshold ? "text-emerald-600" : "text-amber-600"}`}
                  >
                    {candidate.ai_score}
                  </span>
                  <span className="mb-1 text-sm font-medium text-[var(--text-lo)]">
                    /100
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--border)]">
                  <div
                    className={`h-full rounded-full ${candidate.ai_score >= shortlistThreshold ? "bg-emerald-500" : "bg-amber-500"}`}
                    style={{
                      width: `${Math.min(100, Math.max(0, candidate.ai_score))}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--text-lo)]">
                  Shortlist threshold: {shortlistThreshold}
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--text-hi)]">
                    AI recommendation
                  </p>
                  {candidate.shortlisted && (
                    <span className="rounded-lg bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-600">
                      Shortlisted
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[var(--text-lo)]">
                  {candidate.ai_score >= shortlistThreshold
                    ? "The score clears the suggested threshold. Review the evidence below before advancing the candidate."
                    : "The score is below the suggested threshold. A recruiter can still advance the candidate after reviewing the CV and rationale."}
                </p>
                <p className="mt-3 text-xs font-medium text-[var(--text-hi)]">
                  Human review is required before any hiring decision.
                </p>
              </div>
            </div>
            {screeningRubric.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--text-hi)]">
                    Assessment rubric
                  </p>
                  <span className="text-xs text-[var(--text-lo)]">
                    {screeningRubric.length} criteria · 100 points
                  </span>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {screeningRubric.map((criterion) => (
                    <div
                      key={criterion.criterion}
                      className="flex gap-3 px-4 py-3"
                    >
                      <span className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-brand-500/10 px-1.5 text-xs font-bold text-brand-600">
                        {criterion.weight}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-hi)]">
                          {criterion.criterion}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-lo)]">
                          {criterion.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {candidate.ai_justification && (
              <details className="group rounded-2xl bg-[var(--surface-2)] px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--text-hi)]">
                  Read assessment rationale
                  <Icon
                    icon="solar:alt-arrow-down-broken"
                    className="h-4 w-4 text-[var(--text-lo)] transition-transform group-open:rotate-180"
                  />
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[var(--text-lo)]">
                  {candidate.ai_justification}
                </p>
              </details>
            )}
            <p className="text-[11px] text-[var(--text-lo)]">
              AI supports review—your team makes every hiring decision.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-5 text-sm text-[var(--text-lo)]">
            {hasCv
              ? "AI screening is queued automatically. The score will appear here shortly."
              : "Upload a CV to enable automatic AI screening."}
          </div>
        )}
      </section>

      {(candidate.cv_url || candidate.cv_text || cvParsed) && (
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3 capitalize">
            <SectionHeader
              icon="solar:document-text-broken"
              title="CV overview"
            />
          </div>
          {candidate.cv_url && (
            <CandidateCvViewer
              url={candidate.cv_url}
              candidateId={candidate.id}
              variant="inline"
            />
          )}
          {cvParsed ? (
            <div className="space-y-5">
              {cvParsed.skills?.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold text-[var(--text-lo)]">
                    Skills
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cvParsed.skills.map((skill, index) => (
                      <span
                        key={`${skill}-${index}`}
                        className="rounded-full border border-transparent bg-[var(--surface-2)] px-2.5 py-1 text-xs font-medium text-[var(--text-hi)] transition-colors hover:border-brand-500"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {cvParsed.experience?.length ? (
                <div>
                  <p className="mb-2 text-xs font-semibold text-[var(--text-lo)]">
                    Experience
                  </p>
                  <div className="space-y-2">
                    {cvParsed.experience.map((experience, index) => (
                      <div
                        key={index}
                        className="flex gap-3 rounded-xl bg-[var(--surface-2)] p-3"
                      >
                        <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                        <div>
                          <p className="text-sm font-semibold text-[var(--text-hi)]">
                            {experience.title}
                          </p>
                          <p className="text-xs text-[var(--text-lo)]">
                            {experience.company}
                            {experience.duration
                              ? ` · ${experience.duration}`
                              : ""}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : candidate.cv_text ? (
            (() => {
              const sections = candidate.cv_text!.split(/\n{2,}/);
              return (
                <div className="max-h-[520px] overflow-y-auto rounded-xl bg-[var(--surface-2)] p-5 space-y-4">
                  {sections.map((section, i) => {
                    const lines = section.split("\n").filter(Boolean);
                    if (!lines.length) return null;
                    const firstLine = lines[0];
                    const isSectionHeader =
                      /^[A-Z][A-Z\s&/()]+$/.test(firstLine.trim()) &&
                      firstLine.trim().length < 30;
                    return (
                      <div key={i}>
                        {isSectionHeader ? (
                          <>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-brand-500">
                              {firstLine}
                            </p>
                            {lines.slice(1).map((line, j) => (
                              <p
                                key={j}
                                className={`text-sm leading-relaxed ${line.startsWith("-") || line.startsWith("•") ? "pl-3 text-[var(--text-lo)]" : "text-[var(--text-hi)]"}`}
                              >
                                {line}
                              </p>
                            ))}
                          </>
                        ) : (
                          lines.map((line, j) => (
                            <p
                              key={j}
                              className={`text-sm leading-relaxed ${j === 0 && i === 0 ? "font-semibold text-[var(--text-hi)]" : line.startsWith("-") || line.startsWith("•") ? "pl-3 text-[var(--text-lo)]" : "text-[var(--text-hi)]"}`}
                            >
                              {line}
                            </p>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <p className="text-sm text-[var(--text-lo)]">
              The CV has not been parsed yet.
            </p>
          )}
        </section>
      )}

      {hasCv && (
        <span
          id="cv-overview"
          className="block scroll-mt-24"
          aria-hidden="true"
        />
      )}
      <EmailPanel candidateId={candidate.id} />
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <SectionHeader icon="solar:notes-broken" title="Team notes" />
        <NoteForm candidateId={candidate.id} />
        {notes.length > 0 && (
          <div className="mt-5 space-y-4 border-t border-[var(--border)] pt-4">
            {notes.map((note: NoteWithUser) => (
              <div key={note.id} className="flex gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500/10 text-[10px] font-bold text-brand-600">
                  {(note.users?.name ?? "?").slice(0, 1)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="text-xs font-semibold text-[var(--text-hi)]">
                      {note.users?.name ?? "Unknown"}
                    </span>
                    <span className="text-[11px] text-[var(--text-lo)]">
                      {new Date(note.created_at).toLocaleDateString("en-KE", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-hi)]">
                    {note.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );

  const sidebar = (
    <>
      <SidebarWidget
        title="Application"
        icon="solar:case-minimalistic-broken"
        iconClass="bg-brand-500/10 text-brand-500"
      >
        <div className="space-y-3">
          <MetaRow label="Role" value={job?.title ?? "Unassigned"} />
          <MetaRow label="Department" value={job?.department ?? "—"} />
          <MetaRow
            label="Source"
            value={candidate.source?.replaceAll("_", " ") ?? "Direct"}
          />
          <MetaRow
            label="Applied"
            value={new Date(candidate.applied_at).toLocaleDateString("en-KE", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          />
          {candidate.cv_url ? (
            <CandidateCvViewer
              url={candidate.cv_url}
              candidateId={candidate.id}
            />
          ) : candidate.cv_text ? (
            <div className="mt-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-3.5 py-3">
              <p className="text-xs font-semibold text-emerald-600">
                CV text available
              </p>
              <p className="mt-1 text-xs text-[var(--text-lo)]">
                Full application text is ready for AI screening.
              </p>
            </div>
          ) : (
            <div className="mt-3 rounded-xl bg-[var(--surface-2)] px-3.5 py-3">
              <p className="text-xs font-semibold text-[var(--text-hi)]">
                No CV file uploaded
              </p>
              <p className="mt-1 text-xs text-[var(--text-lo)]">
                Parsed application details may still be available above.
              </p>
            </div>
          )}
          {job && (
            <Link
              href={`/hire/candidates?tab=pipeline&job=${candidate.job_id}`}
              className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-500 hover:text-brand-600"
            >
              View role pipeline{" "}
              <Icon icon="solar:arrow-right-broken" className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </SidebarWidget>
      <SidebarWidget
        title="Current status"
        icon="solar:flag-broken"
        iconClass="bg-brand-500/10 text-brand-500"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--text-lo)]">Candidate stage</p>
            <div className="mt-1">
              <StageBadge stage={candidate.stage} />
            </div>
          </div>
          {candidate.shortlisted && (
            <span className="rounded-lg bg-green-500/10 px-2 py-1 text-xs font-semibold text-green-600">
              Shortlisted
            </span>
          )}
        </div>
        {candidate.stage === "interview" && (
          <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
            {canManageInterviews && (
              <BookInterviewButton
                candidateId={candidate.id}
                currentUserId={session?.user.id ?? ""}
                interviewers={interviewers}
              />
            )}
            {interviews.length ? (
              interviews.map((interview) => (
                <div
                  key={interview.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
                >
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-hi)]">
                      {new Date(interview.scheduled_at).toLocaleString(
                        "en-KE",
                        {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                    <p className="text-[11px] text-[var(--text-lo)]">
                      {interview.duration_minutes} min
                    </p>
                  </div>
                  {canManageInterviews ? (
                    <InterviewActions
                      candidateId={candidate.id}
                      interview={interview}
                    />
                  ) : (
                    <Icon
                      icon="solar:calendar-mark-broken"
                      className="h-4 w-4 text-brand-500"
                    />
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-[var(--text-lo)]">
                No upcoming interview booked.
              </p>
            )}
          </div>
        )}
        {candidate.stage === "hired" && (
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            {candidate.hired_user_id ? (
              <Link
                href={`/staff/${candidate.hired_user_id}`}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500"
              >
                Open employee profile{" "}
                <Icon icon="solar:arrow-right-broken" className="h-4 w-4" />
              </Link>
            ) : (
              <OnboardCandidateButton
                candidateId={candidate.id}
                candidateName={candidate.full_name}
                email={candidate.email}
                roleTitle={job?.title ?? null}
                department={job?.department ?? null}
                managers={(managersData ?? []) as never[]}
              />
            )}
          </div>
        )}
      </SidebarWidget>
      {canManageHiring && (
        <SidebarWidget
          title="Danger zone"
          icon="solar:trash-bin-trash-broken"
          iconClass="bg-red-500/10 text-red-500"
        >
          <p className="mb-3 text-xs leading-5 text-[var(--text-lo)]">
            Removes this application, its CV, notes and scorecards permanently.
          </p>
          <DeleteCandidateButton
            candidateId={candidate.id}
            candidateName={candidate.full_name}
          />
        </SidebarWidget>
      )}
    </>
  );

  const headerActions = [
    {
      label: "View CV",
      icon: "solar:document-text-broken",
      scrollToId: "cv-overview",
      variant: "secondary" as const,
      disabled: !hasCv,
    },
    {
      label: "Interview kit",
      icon: "solar:clipboard-check-broken",
      href: `/hire/candidates/${candidate.id}/interview`,
    },
  ];
  return (
    <>
      <SetPageHeader
        title={candidate.full_name}
        description={job ? `Candidate for ${job.title}` : "Candidate profile"}
        icon="solar:user-rounded-broken"
        actions={headerActions}
      />
      <PageWithSidebar main={main} sidebar={sidebar} />
    </>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-500/10">
        <Icon icon={icon} className="h-3.5 w-3.5 text-brand-500" />
      </span>
      <h2 className="text-base font-semibold text-[var(--text-hi)]">{title}</h2>
    </div>
  );
}
function ContactItem({ icon, value }: { icon: string; value: string | null }) {
  return value ? (
    <span className="flex items-center gap-1">
      <Icon icon={icon} className="h-3.5 w-3.5 text-brand-500" />
      {value}
    </span>
  ) : null;
}
function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-[var(--text-lo)]">{label}</span>
      <span className="max-w-[60%] text-right text-xs font-medium capitalize text-[var(--text-hi)]">
        {value}
      </span>
    </div>
  );
}

function formatCvText(text: string | null) {
  if (!text) return null;
  return text
    .replace(
      /\s+(SUMMARY|PROFILE|EXPERIENCE|WORK EXPERIENCE|SKILLS|EDUCATION|CERTIFICATIONS|REFERENCES)\s*/gi,
      "\n\n$1\n",
    )
    .replace(/\s+-\s+/g, "\n• ")
    .replace(/\s{2,}/g, " ")
    .replace(/\n\s+/g, "\n")
    .trim();
}
