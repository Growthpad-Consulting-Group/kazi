"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { Button } from "@/components/ui/Button";

type Question = { id: string; text: string; type: "scale" | "text" };

export function NewSurveyButton({ userId, size = "md" }: { userId: string; size?: "sm" | "md" }) {
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
      <Button size={size} icon="solar:add-circle-broken" className="rounded-lg" onClick={() => setOpen(true)}>New survey</Button>

      <SimpleModal open={open} onClose={() => setOpen(false)} title="New survey" icon="solar:clipboard-list-broken" maxWidth="max-w-lg">
        <div className="space-y-4">

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Q3 Engagement Pulse" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">Description</label>
            <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10" />
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="rounded" />
            <span className="text-sm text-[var(--text-hi)]">Anonymous responses</span>
            <span className="text-xs text-[var(--text-lo)]">(results hidden if &lt; 5 respondents)</span>
          </label>

          <div className="space-y-3">
            <label className="block text-xs font-medium text-[var(--text-lo)]">Questions *</label>
              {questions.map((q, i) => (
              <div key={q.id} className="flex gap-2">
                  <input value={q.text} onChange={(e) => setQuestions(questions.map((x) => x.id === q.id ? { ...x, text: e.target.value } : x))}
                    placeholder={`Question ${i + 1}`} className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10" />
                  <select value={q.type} onChange={(e) => setQuestions(questions.map((x) => x.id === q.id ? { ...x, type: e.target.value as "scale" | "text" } : x))}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-xs text-[var(--text-hi)] outline-none focus:border-brand-500/60">
                    <option value="scale">1–5 scale</option>
                    <option value="text">Open text</option>
                  </select>
                  {questions.length > 1 && (
                  <button type="button" onClick={() => removeQuestion(q.id)} className="px-1 text-[var(--text-lo)] transition-colors hover:text-red-500">×</button>
                  )}
                </div>
              ))}
            <button type="button" onClick={addQuestion} className="text-xs font-medium text-brand-500 hover:underline">+ Add question</button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button onClick={() => setOpen(false)} className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-hi)] hover:bg-[var(--surface-2)] transition-colors">Cancel</button>
            <button onClick={submit} disabled={saving || !title.trim()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-[#d94d18] disabled:opacity-50 transition-colors">
              {saving ? "Creating…" : "Create Survey"}
            </button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
