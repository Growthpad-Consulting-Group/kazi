"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { Button } from "@/components/ui/Button";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";

type Question = {
  id: string;
  text: string;
  type: "scale" | "text" | "choice" | "quiz";
  options?: string[];
  correct_answer?: string;
  time_limit_seconds?: number;
};
type Audience =
  "all" | "staff" | "staff_group" | "department" | "manager_group";
export type SurveyAudienceOptions = {
  staff: { id: string; name: string; department: string | null }[];
  groups: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  departments: string[];
};
const EMPTY_RANGE: DateRangeValue = {
  startDate: null,
  endDate: null,
  label: "Custom Range",
};
const field =
  "mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10";

export function NewSurveyButton({
  size = "md",
  options,
}: {
  size?: "sm" | "md";
  options: SurveyAudienceOptions;
}) {
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
  const [audience, setAudience] = useState<Audience>("all");
  const [audienceIds, setAudienceIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<DateRangeValue>(EMPTY_RANGE);
  const audienceComplete =
    audience === "all" ||
    (audience === "department"
      ? departments.length > 0
      : audienceIds.length > 0);

  function addQuestion() {
    setQuestions([
      ...questions,
      { id: String(Date.now()), text: "", type: "scale" },
    ]);
  }

  function removeQuestion(id: string) {
    setQuestions(questions.filter((q) => q.id !== id));
  }

  async function submit() {
    const valid = questions
      .filter((q) => q.text.trim())
      .map((q) => ({
        ...q,
        options:
          q.type === "choice" || q.type === "quiz"
            ? (q.options ?? []).map((option) => option.trim()).filter(Boolean)
            : undefined,
      }));
    if (!title.trim() || !valid.length || !audienceComplete) return;
    if (
      valid.some(
        (q) =>
          (q.type === "choice" || q.type === "quiz") &&
          (q.options?.length ?? 0) < 2,
      )
    ) {
      setError("A poll or quiz needs at least two options.");
      return;
    }
    if (
      valid.some(
        (q) =>
          q.type === "quiz" &&
          (!q.correct_answer ||
            !q.options?.includes(q.correct_answer) ||
            !q.time_limit_seconds ||
            q.time_limit_seconds < 10),
      )
    ) {
      setError(
        "Each quiz needs a correct answer and a time limit of at least 10 seconds.",
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          anonymous,
          questions: valid,
          audienceType: audience,
          audienceIds,
          audienceDepartments: departments,
          opensAt: schedule.startDate?.toISOString() ?? null,
          closesAt: schedule.endDate
            ? new Date(
                schedule.endDate.getFullYear(),
                schedule.endDate.getMonth(),
                schedule.endDate.getDate(),
                23,
                59,
                59,
                999,
              ).toISOString()
            : null,
        }),
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
      <Button
        size={size}
        icon="solar:add-circle-broken"
        className="rounded-lg"
        onClick={() => setOpen(true)}
      >
        New survey
      </Button>

      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="New survey"
        icon="solar:clipboard-list-broken"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">
              Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 Engagement Pulse"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-[var(--text-hi)]">
              Anonymous responses
            </span>
            <span className="text-xs text-[var(--text-lo)]">
              (results hidden if &lt; 5 respondents)
            </span>
          </label>

          <div className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/35 p-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-[var(--text-lo)]">
              Audience
              <select
                value={audience}
                onChange={(event) => {
                  setAudience(event.target.value as Audience);
                  setAudienceIds([]);
                  setDepartments([]);
                }}
                className={field}
              >
                <option value="all">All active staff</option>
                <option value="staff">Selected staff</option>
                <option value="staff_group">Staff groups</option>
                <option value="department">Departments</option>
                <option value="manager_group">Manager&apos;s team</option>
              </select>
            </label>
            <div>
              <p className="text-xs font-medium text-[var(--text-lo)]">
                Schedule <span className="font-normal">Optional</span>
              </p>
              <DateRangePicker
                value={schedule}
                onChange={setSchedule}
                maxDate={null}
                fullWidth
                allowedRanges={[
                  "Today",
                  "This Week",
                  "Next Week",
                  "This Month",
                  "Next Month",
                  "Custom Range",
                ]}
                className="mt-1.5"
              />
            </div>
          </div>
          {audience === "staff" && (
            <label className="block text-xs font-medium text-[var(--text-lo)]">
              Select staff{" "}
              <span className="font-normal">Hold ⌘ / Ctrl for several</span>
              <select
                multiple
                value={audienceIds}
                onChange={(event) =>
                  setAudienceIds(
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
                className={field + " h-28"}
              >
                {options.staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                    {person.department ? ` · ${person.department}` : ""}
                  </option>
                ))}
              </select>
            </label>
          )}
          {audience === "staff_group" && (
            <label className="block text-xs font-medium text-[var(--text-lo)]">
              Select staff groups{" "}
              <span className="font-normal">Hold ⌘ / Ctrl for several</span>
              <select
                multiple
                value={audienceIds}
                onChange={(event) =>
                  setAudienceIds(
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
                className={field + " h-28"}
              >
                {options.groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {audience === "department" && (
            <label className="block text-xs font-medium text-[var(--text-lo)]">
              Select departments{" "}
              <span className="font-normal">Hold ⌘ / Ctrl for several</span>
              <select
                multiple
                value={departments}
                onChange={(event) =>
                  setDepartments(
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
                className={field + " h-28"}
              >
                {options.departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
          )}
          {audience === "manager_group" && (
            <label className="block text-xs font-medium text-[var(--text-lo)]">
              Select manager teams{" "}
              <span className="font-normal">Hold ⌘ / Ctrl for several</span>
              <select
                multiple
                value={audienceIds}
                onChange={(event) =>
                  setAudienceIds(
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
                className={field + " h-28"}
              >
                {options.managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="space-y-3">
            <label className="block text-xs font-medium text-[var(--text-lo)]">
              Questions *
            </label>
            {questions.map((q, i) => (
              <div
                key={q.id}
                className="rounded-xl bg-[var(--surface-2)]/55 p-2.5"
              >
                <div className="flex gap-2">
                  <input
                    value={q.text}
                    onChange={(e) =>
                      setQuestions(
                        questions.map((x) =>
                          x.id === q.id ? { ...x, text: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder={`Question ${i + 1}`}
                    className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/10"
                  />
                  <select
                    value={q.type}
                    onChange={(e) =>
                      setQuestions(
                        questions.map((x) =>
                          x.id === q.id
                            ? {
                                ...x,
                                type: e.target.value as Question["type"],
                                options:
                                  e.target.value === "choice" ||
                                  e.target.value === "quiz"
                                    ? (x.options ?? ["", ""])
                                    : undefined,
                                correct_answer:
                                  e.target.value === "quiz"
                                    ? x.correct_answer
                                    : undefined,
                                time_limit_seconds:
                                  e.target.value === "quiz"
                                    ? (x.time_limit_seconds ?? 60)
                                    : undefined,
                              }
                            : x,
                        ),
                      )
                    }
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-2 text-xs text-[var(--text-hi)] outline-none focus:border-brand-500/60"
                  >
                    <option value="scale">1–5 scale</option>
                    <option value="choice">Single-choice poll</option>
                    <option value="quiz">Scored quiz</option>
                    <option value="text">Open text</option>
                  </select>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(q.id)}
                      className="px-1 text-[var(--text-lo)] transition-colors hover:text-red-500"
                    >
                      ×
                    </button>
                  )}
                </div>
                {(q.type === "choice" || q.type === "quiz") && (
                  <>
                    <textarea
                      rows={2}
                      value={(q.options ?? []).join("\n")}
                      onChange={(e) =>
                        setQuestions(
                          questions.map((x) =>
                            x.id === q.id
                              ? { ...x, options: e.target.value.split("\n") }
                              : x,
                          ),
                        )
                      }
                      placeholder="One option per line"
                      className="mt-2 w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-hi)] outline-none focus:border-brand-500/60"
                    />
                    {q.type === "quiz" && (
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <select
                          value={q.correct_answer ?? ""}
                          onChange={(e) =>
                            setQuestions(
                              questions.map((x) =>
                                x.id === q.id
                                  ? { ...x, correct_answer: e.target.value }
                                  : x,
                              ),
                            )
                          }
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs"
                        >
                          <option value="">Correct answer</option>
                          {(q.options ?? []).filter(Boolean).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="10"
                          value={q.time_limit_seconds ?? 60}
                          onChange={(e) =>
                            setQuestions(
                              questions.map((x) =>
                                x.id === q.id
                                  ? {
                                      ...x,
                                      time_limit_seconds: Number(
                                        e.target.value,
                                      ),
                                    }
                                  : x,
                              ),
                            )
                          }
                          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs"
                          aria-label="Time limit in seconds"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addQuestion}
              className="text-xs font-medium text-brand-500 hover:underline"
            >
              + Add question
            </button>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-hi)] hover:bg-[var(--surface-2)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !title.trim() || !audienceComplete}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-[#d94d18] disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating…" : "Create Survey"}
            </button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
