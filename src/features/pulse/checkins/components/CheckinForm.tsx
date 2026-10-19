"use client";

import { useState } from "react";
import type { Checkin } from "@/types/database";

interface Props {
  userId: string;
  weekStart: string;
  existing: Checkin | null;
}

const MOODS = [
  { value: 1, emoji: "😔", label: "Struggling" },
  { value: 2, emoji: "😕", label: "Low" },
  { value: 3, emoji: "😐", label: "Okay" },
  { value: 4, emoji: "🙂", label: "Good" },
  { value: 5, emoji: "😄", label: "Great" },
];

export function CheckinForm({ userId, weekStart, existing }: Props) {
  const [wins, setWins] = useState(existing?.wins ?? "");
  const [priorities, setPriorities] = useState(existing?.priorities ?? "");
  const [blockers, setBlockers] = useState(existing?.blockers ?? "");
  const [mood, setMood] = useState<number>(existing?.mood ?? 3);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const isReviewed = existing?.status === "reviewed";

  async function save(submit: boolean) {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/pulse/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          weekStart,
          wins,
          priorities,
          blockers,
          mood,
          status: submit ? "submitted" : "draft",
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (isReviewed) {
    return (
      <div className="space-y-4">
        <ReadField label="Wins & accomplishments" value={existing?.wins} />
        <ReadField label="Priorities next week" value={existing?.priorities} />
        <ReadField label="Blockers" value={existing?.blockers} />
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Mood</p>
          <p className="text-sm text-slate-700">
            {MOODS.find((m) => m.value === existing?.mood)?.emoji ?? "—"}{" "}
            {MOODS.find((m) => m.value === existing?.mood)?.label ?? ""}
          </p>
        </div>
        {existing?.manager_comment && (
          <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
            <p className="text-xs font-semibold text-blue-600 mb-1">Manager feedback</p>
            <p className="text-sm text-blue-800">{existing.manager_comment}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(false); }}>
      <Field
        label="Wins & accomplishments"
        hint="What went well this week?"
        value={wins}
        onChange={setWins}
      />
      <Field
        label="Priorities next week"
        hint="Top 3 things you're focused on"
        value={priorities}
        onChange={setPriorities}
      />
      <Field
        label="Blockers"
        hint="Anything slowing you down or needing support?"
        value={blockers}
        onChange={setBlockers}
      />

      {/* Mood */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">How are you feeling?</p>
        <div className="flex gap-2">
          {MOODS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMood(m.value)}
              className={`flex flex-col items-center gap-1 rounded-xl px-3 py-2 transition-colors ${
                mood === m.value
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <span className="text-xl">{m.emoji}</span>
              <span className="text-xs font-medium">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => save(false)}
          disabled={saving}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
        >
          Save draft
        </button>
        <button
          type="button"
          onClick={() => save(true)}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Submitting…" : "Submit check-in"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <p className="text-xs text-slate-400 mb-1.5">{hint}</p>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
    </div>
  );
}

function ReadField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{value || <span className="text-slate-400 italic">Not filled in</span>}</p>
    </div>
  );
}
