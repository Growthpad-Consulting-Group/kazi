import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "../actions";
import { JobStatusBadge } from "./JobStatusBadge";

export default async function JobDetailPage({ id }: { id: string }) {
  const job = await getJob(id).catch(() => null);
  if (!job) notFound();

  return (
    <div className="max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{job.title}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {[job.department, job.location].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/hire/jobs/${job.id}/edit`}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Edit
          </Link>
          <Link
            href={`/hire/candidates?job=${job.id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            View candidates
          </Link>
        </div>
      </div>

      {job.description && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm mb-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Description</h2>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{job.description}</p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Must-haves</h2>
          {job.requirements.must_haves.length ? (
            <ul className="space-y-1">
              {job.requirements.must_haves.map((r, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-green-500 mt-0.5">✓</span> {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">None specified</p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Nice-to-haves</h2>
          {job.requirements.nice_to_haves.length ? (
            <ul className="space-y-1">
              {job.requirements.nice_to_haves.map((r, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-blue-400 mt-0.5">○</span> {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">None specified</p>
          )}
        </section>
      </div>

      {job.scoring_rubric.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">AI Screening Rubric</h2>
          <div className="space-y-2">
            {job.scoring_rubric.map((r, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="w-10 text-right font-mono text-xs text-slate-400 mt-0.5">
                  {r.weight}%
                </span>
                <div>
                  <span className="font-medium text-slate-800">{r.criterion}</span>
                  {r.description && (
                    <span className="text-slate-500"> — {r.description}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
