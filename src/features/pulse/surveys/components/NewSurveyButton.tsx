"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Question = { id: string; text: string; type: "scale" | "text" };

export function NewSurveyButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([
    { id: "1", text: "", type: "scale" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function addQuestion() {
    setQuestions([...questions, { id: String(Date.now()), text: "", type: "scale" }]);
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter((q) => q.id !== id));
  }

  async function submit() {
    const valid = questions.filter((q) => q.text.trim());
    if (!title.trim() || !valid.length) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, anonymous, questions: valid, created_by: userId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      setOpen(false);
      router.push(`/pulse/surveys/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors">
        + New Survey
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-slate-900">New Survey</h2>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 Engagement Pulse" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
              <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="rounded" />
              <span className="text-sm text-slate-700">Anonymous responses</span>
              <span className="text-xs text-slate-400">(results hidden if &lt; 5 respondents)</span>
            </label>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-500">Questions *</label>
              {questions.map((q, i) => (
                <div key={q.id} className="flex gap-2">
                  <input value={q.text} onChange={(e) => setQuestions(questions.map((x) => x.id === q.id ? { ...x, text: e.target.value } : x))}
                    placeholder={`Question ${i + 1}`} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600" />
                  <select value={q.type} onChange={(e) => setQuestions(questions.map((x) => x.id === q.id ? { ...x, type: e.target.value as "scale" | "text" } : x))}
                    className="rounded-lg border border-slate-300 px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600">
                    <option value="scale">1–5 scale</option>
                    <option value="text">Open text</option>
                  </select>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(q.id)} className="text-slate-300 hover:text-red-400 transition-colors px-1">×</button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addQuestion} className="text-xs text-blue-600 hover:underline">+ Add question</button>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={submit} disabled={saving || !title.trim()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors">
                {saving ? "Creating…" : "Create Survey"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
