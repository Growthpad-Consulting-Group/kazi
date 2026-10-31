"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewCycle } from "@/types/database";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import { DatePicker } from "@/components/ui/DatePicker";
import { NewCompetencyTemplateButton } from "./NewCompetencyTemplateButton";

const CYCLES: ReviewCycle[] = ["quarterly", "biannual", "annual"];
type CompetencyTemplate = {
  id: string;
  name: string;
  scope: string;
  scope_value: string | null;
};

export function NewCycleButton({ size = "md" }: { size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [cycle, setCycle] = useState<ReviewCycle>("quarterly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selfDueDate, setSelfDueDate] = useState("");
  const [managerDueDate, setManagerDueDate] = useState("");
  const [peerDueDate, setPeerDueDate] = useState("");
  const [minPeers, setMinPeers] = useState(1);
  const [maxPeers, setMaxPeers] = useState(3);
  const [anonymousPeers, setAnonymousPeers] = useState(false);
  const [templates, setTemplates] = useState<CompetencyTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/pulse/review-templates")
      .then((response) => (response.ok ? response.json() : []))
      .then((data: CompetencyTemplate[]) => setTemplates(data))
      .catch(() => setTemplates([]));
  }, [open]);

  async function submit() {
    if (!title.trim() || !startDate || !endDate) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          cycle,
          start_date: startDate,
          end_date: endDate,
          self_review_due_date: selfDueDate || null,
          manager_review_due_date: managerDueDate || null,
          peer_review_due_date: peerDueDate || null,
          min_peer_reviews: minPeers,
          max_peer_reviews: maxPeers,
          peer_feedback_anonymous: anonymousPeers,
          competency_template_id: templateId || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const json = await res.json();
      setOpen(false);
      router.push(`/pulse/reviews/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  const dateRange: DateRangeValue = {
    startDate: startDate ? new Date(`${startDate}T12:00:00`) : null,
    endDate: endDate ? new Date(`${endDate}T12:00:00`) : null,
    label: "Custom Range",
  };

  return (
    <>
      <Button
        size={size}
        icon="solar:calendar-add-broken"
        className="rounded-lg"
        onClick={() => setOpen(true)}
      >
        New cycle
      </Button>

      <SimpleModal
        open={open}
        onClose={() => setOpen(false)}
        title="New review cycle"
        icon="solar:clipboard-list-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Cycle name *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q3 2026 Performance Review"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate-500">
              Stage deadlines <span className="font-normal">Optional</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="text-[11px] text-[var(--text-lo)]">
                  Self review
                </span>
                <DatePicker
                  value={selfDueDate}
                  onChange={setSelfDueDate}
                  minDate={
                    startDate ? new Date(`${startDate}T12:00:00`) : undefined
                  }
                  maxDate={
                    endDate ? new Date(`${endDate}T12:00:00`) : undefined
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-[var(--text-lo)]">
                  Manager review
                </span>
                <DatePicker
                  value={managerDueDate}
                  onChange={setManagerDueDate}
                  minDate={
                    selfDueDate
                      ? new Date(`${selfDueDate}T12:00:00`)
                      : undefined
                  }
                  maxDate={
                    endDate ? new Date(`${endDate}T12:00:00`) : undefined
                  }
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-[var(--text-lo)]">
                  Peer review
                </span>
                <DatePicker
                  value={peerDueDate}
                  onChange={setPeerDueDate}
                  minDate={
                    managerDueDate
                      ? new Date(`${managerDueDate}T12:00:00`)
                      : undefined
                  }
                  maxDate={
                    endDate ? new Date(`${endDate}T12:00:00`) : undefined
                  }
                />
              </label>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/50 p-3">
            <p className="text-xs font-semibold text-[var(--text-hi)]">
              Peer feedback
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <label className="text-[11px] text-[var(--text-lo)]">
                Minimum peers
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={minPeers}
                  onChange={(event) => setMinPeers(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-hi)]"
                />
              </label>
              <label className="text-[11px] text-[var(--text-lo)]">
                Maximum peers
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={maxPeers}
                  onChange={(event) => setMaxPeers(Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-sm text-[var(--text-hi)]"
                />
              </label>
            </div>
            <label className="mt-3 flex items-center gap-2 text-xs text-[var(--text-hi)]">
              <input
                type="checkbox"
                checked={anonymousPeers}
                onChange={(event) => setAnonymousPeers(event.target.checked)}
              />{" "}
              Keep peer feedback anonymous to the employee
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-hi)]">
              Competency template{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
            </label>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500"
            >
              <option value="">Kazi&apos;s standard competencies</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} ·{" "}
                  {template.scope === "company"
                    ? "Company"
                    : template.scope_value}
                </option>
              ))}
            </select>
            <p className="mt-1 text-[11px] text-[var(--text-lo)]">
              The selected criteria, weights and guidance are saved with this
              cycle.
            </p>
            <NewCompetencyTemplateButton
              onCreated={(template) => {
                setTemplates((current) => [...current, template]);
                setTemplateId(template.id);
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Frequency
            </label>
            <div className="flex gap-2">
              {CYCLES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCycle(c)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${cycle === c ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Review period *
            </label>
            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                setStartDate(range.startDate?.toISOString().slice(0, 10) ?? "");
                setEndDate(range.endDate?.toISOString().slice(0, 10) ?? "");
              }}
              maxDate={null}
              allowedRanges={["Custom Range"]}
              fullWidth
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={saving || !title.trim() || !startDate || !endDate}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
