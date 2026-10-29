"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { InterviewerPicker, type InterviewerOption } from "./InterviewerPicker";

type Recipient = { id: string; full_name: string };
type Result = {
  candidateId: string;
  name: string;
  ok: boolean;
  error?: string;
};

const GAP_OPTIONS = [0, 5, 10, 15];
const DURATION_OPTIONS = [30, 45, 60, 90];

export function BulkInterviewModal({
  recipients,
  interviewers,
  currentUserId,
  onClose,
}: {
  recipients: Recipient[];
  interviewers: InterviewerOption[];
  currentUserId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [gapMinutes, setGapMinutes] = useState(0);
  const [selected, setSelected] = useState<string[]>([currentUserId]);
  const [phase, setPhase] = useState<"form" | "booking" | "done">("form");
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);

  const slots = useMemo(() => {
    if (!date || !time) return [];
    const first = new Date(`${date}T${time}`);
    if (Number.isNaN(first.getTime())) return [];
    return recipients.map((recipient, index) => ({
      recipient,
      start: new Date(
        first.getTime() + index * (durationMinutes + gapMinutes) * 60_000,
      ),
    }));
  }, [date, time, durationMinutes, gapMinutes, recipients]);

  const toggle = (id: string) => {
    if (id === currentUserId) return;
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const close = () => {
    if (phase === "booking") return;
    onClose();
  };

  const book = async () => {
    if (!slots.length) {
      toast.error("Choose a start date and time");
      return;
    }
    setPhase("booking");
    setProgress(0);
    const outcome: Result[] = [];
    for (const slot of slots) {
      try {
        const res = await fetch(
          `/api/hire/candidates/${slot.recipient.id}/interviews`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scheduledAt: slot.start.toISOString(),
              durationMinutes,
              interviewerIds: selected,
            }),
          },
        );
        const json = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        outcome.push({
          candidateId: slot.recipient.id,
          name: slot.recipient.full_name,
          ok: res.ok,
          error: res.ok ? undefined : (json?.error ?? "Could not book"),
        });
      } catch {
        outcome.push({
          candidateId: slot.recipient.id,
          name: slot.recipient.full_name,
          ok: false,
          error: "Could not book",
        });
      }
      setProgress((p) => p + 1);
    }
    setResults(outcome);
    const okCount = outcome.filter((r) => r.ok).length;
    if (okCount === outcome.length)
      toast.success(`Booked ${okCount} interview${okCount === 1 ? "" : "s"}`);
    else toast.error(`Booked ${okCount}, ${outcome.length - okCount} failed`);
    setPhase("done");
    router.refresh();
  };

  return (
    <SimpleModal
      open
      onClose={close}
      title="Schedule interviews"
      icon="solar:calendar-add-broken"
      maxWidth="max-w-2xl"
    >
      {phase === "form" && (
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-lo)]">
            {recipients.length} candidate{recipients.length === 1 ? "" : "s"}{" "}
            selected. Interviews are booked back to back from the start time,
            one candidate per slot.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-lo)]">
                Start date
              </span>
              <DatePicker
                value={date}
                onChange={setDate}
                minDate={new Date()}
                placeholder="Select date"
              />
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-lo)]">
                Start time
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-lo)]">
                Duration
              </span>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
              >
                {DURATION_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-lo)]">
                Break between interviews
              </span>
              <select
                value={gapMinutes}
                onChange={(e) => setGapMinutes(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
              >
                {GAP_OPTIONS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "None" : `${m} minutes`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <InterviewerPicker
            interviewers={interviewers}
            selected={selected}
            currentUserId={currentUserId}
            onToggle={toggle}
          />

          {slots.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-lo)]">
                Schedule preview
              </span>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-1.5">
                {slots.map((slot) => (
                  <div
                    key={slot.recipient.id}
                    className="flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm"
                  >
                    <span className="truncate text-[var(--text-hi)]">
                      {slot.recipient.full_name}
                    </span>
                    <span className="shrink-0 text-xs text-[var(--text-lo)]">
                      {slot.start.toLocaleString("en-KE", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button
              icon="solar:calendar-add-broken"
              disabled={!slots.length}
              onClick={book}
            >
              Book {recipients.length} interview
              {recipients.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      {phase === "booking" && (
        <div className="space-y-3 py-6 text-center">
          <p className="text-sm font-medium text-[var(--text-hi)]">
            Booking {Math.min(progress + 1, slots.length)} of {slots.length}…
          </p>
          <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full bg-brand-500 transition-all duration-300"
              style={{ width: `${(progress / slots.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {phase === "done" && (
        <div className="space-y-4">
          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
            {results.map((result) => (
              <div
                key={result.candidateId}
                className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2.5"
              >
                <span className="text-sm text-[var(--text-hi)]">
                  {result.name}
                </span>
                {result.ok ? (
                  <span className="text-xs font-medium text-green-600">
                    Booked
                  </span>
                ) : (
                  <span className="text-xs text-red-500">{result.error}</span>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </SimpleModal>
  );
}
