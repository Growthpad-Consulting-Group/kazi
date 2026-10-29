"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";

interface Props {
  directReports: { id: string; name: string }[];
  managerId: string;
}

const CHECK_IN_OPTIONS = ["Daily", "Weekly", "Fortnightly", "Monthly"];
const inputClass =
  "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/20";
const labelClass = "block text-xs font-semibold text-[var(--text-hi)]";

function toDateValue(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export function NewPipButton({
  directReports,
  size = "md",
}: Props & { size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    user_id: "",
    concern: "",
    expected_outcomes: "",
    support_provided: "",
    check_in_frequency: "Weekly",
    start_date: toDateValue(new Date()),
    review_date: "",
  });

  async function submit() {
    if (
      !form.user_id ||
      !form.concern.trim() ||
      !form.expected_outcomes.trim()
    ) {
      toast.error(
        "Choose an employee and fill in the concern and expected outcomes.",
      );
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/pips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not create the plan.");
      toast.success("Support plan created");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create the plan.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size={size}
        icon="solar:add-circle-broken"
        onClick={() => setOpen(true)}
      >
        New support plan
      </Button>
      <SimpleModal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="New performance support plan"
        icon="solar:heart-pulse-broken"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <label className={labelClass}>
            Employee
            <select
              value={form.user_id}
              onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              className={inputClass}
            >
              <option value="">Choose an employee</option>
              {directReports.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className={labelClass}>
            Performance concern
            <textarea
              rows={3}
              value={form.concern}
              onChange={(e) => setForm({ ...form, concern: e.target.value })}
              placeholder="Describe the performance issue clearly and objectively…"
              className={`${inputClass} resize-y`}
            />
          </label>
          <label className={labelClass}>
            Expected outcomes
            <textarea
              rows={3}
              value={form.expected_outcomes}
              onChange={(e) =>
                setForm({ ...form, expected_outcomes: e.target.value })
              }
              placeholder="What measurable improvement is expected, and by when?"
              className={`${inputClass} resize-y`}
            />
          </label>
          <label className={labelClass}>
            Support provided{" "}
            <span className="font-normal text-[var(--text-lo)]">Optional</span>
            <textarea
              rows={2}
              value={form.support_provided}
              onChange={(e) =>
                setForm({ ...form, support_provided: e.target.value })
              }
              placeholder="Coaching, training, resources being offered…"
              className={`${inputClass} resize-y`}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
            <div>
              <p className={labelClass}>Plan window</p>
              <div className="mt-1.5">
                <DateRangePicker
                  value={{
                    startDate: form.start_date
                      ? new Date(`${form.start_date}T12:00:00`)
                      : null,
                    endDate: form.review_date
                      ? new Date(`${form.review_date}T12:00:00`)
                      : null,
                  }}
                  onChange={(range) =>
                    setForm({
                      ...form,
                      start_date: range.startDate
                        ? toDateValue(range.startDate)
                        : "",
                      review_date: range.endDate
                        ? toDateValue(range.endDate)
                        : "",
                    })
                  }
                  allowedRanges={["Custom Range"]}
                  maxDate={null}
                  fullWidth
                />
              </div>
            </div>
            <label className={labelClass}>
              Check-ins
              <select
                value={form.check_in_frequency}
                onChange={(e) =>
                  setForm({ ...form, check_in_frequency: e.target.value })
                }
                className={inputClass}
              >
                {CHECK_IN_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={
                !form.user_id ||
                !form.concern.trim() ||
                !form.expected_outcomes.trim() ||
                !form.start_date
              }
              onClick={submit}
            >
              Create plan
            </Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
