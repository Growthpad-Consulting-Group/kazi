import Link from "next/link";
import { notFound } from "next/navigation";
import { getCandidate, getCandidateNotes, type NoteWithUser } from "../actions";
import { StageBadge } from "./StageBadge";
import { StageAdvancer } from "./StageAdvancer";
import { ScreenButton } from "./ScreenButton";
import { NoteForm } from "./NoteForm";
import { EmailPanel } from "./EmailPanel";
import type { CandidateStage } from "../types";

type CvParsed = {
  skills?: string[];
  experience?: { title: string; company: string; duration: string }[];
  education?: { degree: string; institution: string; year: string }[];
};

export default async function CandidateDetailPage({ id }: { id: string }) {
  const candidate = await getCandidate(id).catch(() => null);
  if (!candidate) notFound();

  const notes = await getCandidateNotes(id);
  const job = candidate.jobs;
  const cvParsed = candidate.cv_parsed as CvParsed | null;

  const stages: CandidateStage[] = ["applied", "screened", "interview", "offer", "hired"];

  return (
    <div className="max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{candidate.full_name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {candidate.email}
            {candidate.phone ? ` · ${candidate.phone}` : ""}
            {candidate.location ? ` · ${candidate.location}` : ""}
          </p>
          {job && (
            <p className="mt-1 text-sm text-blue-600 font-medium">
              {job.title}{job.department ? ` — ${job.department}` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={candidate.stage} />
          <Link
            href={`/hire/candidates/${candidate.id}/interview`}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Interview Kit
          </Link>
        </div>
      </div>

      {/* Stage pipeline */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow duration-200">
        <p className="text-xs font-semibold text-slate-500 mb-3 uppercase tracking-wide">Pipeline</p>
        <div className="flex items-center gap-1 flex-wrap">
          {stages.map((s, i, arr) => (
            <div key={s} className="flex items-center gap-1">
              <StageAdvancer candidateId={candidate.id} stage={s} current={candidate.stage} />
              {i < arr.length - 1 && <span className="text-slate-300 text-xs">›</span>}
            </div>
          ))}
          <div className="ml-2">
            <StageAdvancer candidateId={candidate.id} stage="rejected" current={candidate.stage} />
          </div>
        </div>
      </div>

      {/* AI Screening */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-slate-700">AI Screening</p>
          <ScreenButton
            candidateId={candidate.id}
            hasCV={!!(candidate.cv_text || candidate.cv_parsed)}
          />
        </div>
        {candidate.ai_score !== null ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className={`text-3xl font-bold ${candidate.ai_score >= 65 ? "text-green-600" : "text-slate-500"}`}>
                {candidate.ai_score}
                <span className="text-base font-normal text-slate-400">/100</span>
              </span>
              {candidate.shortlisted && (
                <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">
                  Shortlisted
                </span>
              )}
            </div>
            {candidate.ai_justification && (
              <p className="text-sm text-slate-600">{candidate.ai_justification}</p>
            )}
            <p className="text-xs text-slate-400 italic">
              AI ranking only — a recruiter makes every advance/reject decision.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Not screened yet.{" "}
            {!candidate.cv_text && !candidate.cv_parsed
              ? "Upload a CV first."
              : "Click Screen to run AI scoring."}
          </p>
        )}
      </div>

      {/* CV */}
      {candidate.cv_url && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="text-sm font-semibold text-slate-700 mb-2">CV</p>
          <a
            href={candidate.cv_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            View uploaded CV ↗
          </a>
          {cvParsed && (
            <div className="mt-4 space-y-3">
              {cvParsed.skills && cvParsed.skills.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Skills</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cvParsed.skills.map((s, i) => (
                      <span key={i} className="rounded-full bg-slate-100 text-slate-600 px-2.5 py-0.5 text-xs">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {cvParsed.experience && cvParsed.experience.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-slate-500 mb-1">Experience</p>
                  <ul className="space-y-1">
                    {cvParsed.experience.map((e, i) => (
                      <li key={i} className="text-xs text-slate-600">
                        {e.title} at {e.company}
                        {e.duration ? ` · ${e.duration}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Email */}
      <EmailPanel candidateId={candidate.id} />

      {/* Notes */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
        <p className="text-sm font-semibold text-slate-700 mb-3">Notes</p>
        <NoteForm candidateId={candidate.id} />
        {notes.length > 0 && (
          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            {notes.map((n: NoteWithUser) => (
              <div key={n.id}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-medium text-slate-700">
                    {n.users?.name ?? "Unknown"}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(n.created_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{n.note}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
