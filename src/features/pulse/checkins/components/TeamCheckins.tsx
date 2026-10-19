"use client";

import { useState } from "react";
import type { CheckinWithUser } from "../actions";

interface Props {
  checkins: CheckinWithUser[];
  weekStart: string;
}

const MOODS = ["😔", "😕", "😐", "🙂", "😄"];

export function TeamCheckins({ checkins, weekStart }: Props) {
  const thisWeek = checkins.filter((c) => c.week_start === weekStart);
  const others = checkins.filter((c) => c.week_start !== weekStart);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitReview(checkinId: string) {
    setSaving(true);
    try {
      await fetch("/api/pulse/checkins/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkinId, comment }),
      });
      setExpanded(null);
      setComment("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
        Team Check-ins — This Week ({thisWeek.length})
      </h2>

      {thisWeek.length === 0 && (
        <p className="text-sm text-slate-400">No team check-ins submitted yet this week.</p>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {thisWeek.map((c, i) => (
          <div key={c.id} className={i > 0 ? "border-t border-slate-100" : ""}>
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
              onClick={() => setExpanded(expanded === c.id ? null : c.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
                  {c.users?.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-slate-900">{c.users?.name ?? "—"}</p>
                  <p className="text-xs text-slate-400">{c.users?.job_title ?? c.users?.department ?? ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {c.mood && <span className="text-lg">{MOODS[c.mood - 1]}</span>}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === "reviewed" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-600"}`}>
                  {c.status}
                </span>
                <span className="text-slate-300">{expanded === c.id ? "▲" : "▼"}</span>
              </div>
            </button>

            {expanded === c.id && (
              <div className="px-5 pb-5 space-y-4 border-t border-slate-100 bg-slate-50">
                <ReadSection label="Wins" value={c.wins} />
                <ReadSection label="Priorities" value={c.priorities} />
                <ReadSection label="Blockers" value={c.blockers} />

                {c.ai_summary && (
                  <div className="rounded-lg bg-violet-50 border border-violet-100 p-3">
                    <p className="text-xs font-semibold text-violet-600 mb-1">AI Summary</p>
                    <p className="text-sm text-violet-900">{c.ai_summary}</p>
                  </div>
                )}

                {c.status !== "reviewed" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-slate-500">Your comment (optional)</label>
                    <textarea
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Reply to this check-in…"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      onClick={() => submitReview(c.id)}
                      disabled={saving}
                      className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
                    >
                      {saving ? "Saving…" : "Mark Reviewed"}
                    </button>
                  </div>
                )}

                {c.manager_comment && (
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                    <p className="text-xs font-semibold text-blue-600 mb-1">Your feedback</p>
                    <p className="text-sm text-blue-800">{c.manager_comment}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {others.length > 0 && (
        <p className="text-xs text-slate-400">{others.length} check-in{others.length > 1 ? "s" : ""} from previous weeks.</p>
      )}
    </div>
  );
}

function ReadSection({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="pt-3">
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value}</p>
    </div>
  );
}
