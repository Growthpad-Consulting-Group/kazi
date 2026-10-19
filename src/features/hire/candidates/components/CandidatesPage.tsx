import Link from "next/link";
import { getCandidates, type CandidateWithJob } from "../actions";
import { StageBadge } from "./StageBadge";
import { BulkScreenButton } from "./BulkScreenButton";

export default async function CandidatesPage({ jobId }: { jobId?: string }) {
  const candidates = await getCandidates(jobId);
  const unscreened = candidates.filter((c) => c.ai_score === null && (c.cv_text || c.cv_parsed));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Candidates</h1>
          <p className="mt-1 text-sm text-slate-500">
            {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
            {jobId ? " for this role" : " across all roles"}
          </p>
        </div>
        {unscreened.length > 0 && (
          <BulkScreenButton candidateIds={unscreened.map((c) => c.id)} />
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <p className="text-slate-500 text-sm">No candidates yet.</p>
          <p className="text-slate-400 text-xs mt-1">
            Share the public apply link once a job is open.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Stage</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">AI Score</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Shortlisted</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Applied</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c: CandidateWithJob) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{c.full_name}</div>
                    <div className="text-xs text-slate-400">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {c.jobs?.title ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StageBadge stage={c.stage} />
                  </td>
                  <td className="px-4 py-3">
                    {c.ai_score !== null ? (
                      <span className={`font-semibold ${c.ai_score >= 65 ? "text-green-600" : "text-slate-500"}`}>
                        {c.ai_score}
                      </span>
                    ) : (
                      <span className="text-slate-300 text-xs">Not screened</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.shortlisted ? (
                      <span className="text-green-600 text-xs font-medium">✓ Yes</span>
                    ) : (
                      <span className="text-slate-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {new Date(c.applied_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/hire/candidates/${c.id}`}
                      className="text-blue-600 hover:text-blue-800 font-medium text-xs"
                    >
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
