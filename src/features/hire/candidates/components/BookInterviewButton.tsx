"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { DatePicker } from "@/components/ui/DatePicker";

export type InterviewerOption = { id: string; name: string; job_title: string | null };

export function BookInterviewButton({
  candidateId,
  currentUserId,
  interviewers,
}: {
  candidateId: string;
  currentUserId: string;
  interviewers: InterviewerOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [selected, setSelected] = useState<string[]>([currentUserId]);
  const [isPending, startTransition] = useTransition();

  const toggle = (id: string) => {
    if (id === currentUserId) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const save = () => {
    if (!date || !time) {
      toast.error("Choose a date and time");
      return;
    }
    startTransition(async () => {
      const res = await fetch(`/api/hire/candidates/${candidateId}/interviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: new Date(`${date}T${time}`).toISOString(),
          durationMinutes: Number(durationMinutes),
          interviewerIds: selected,
        }),
      });
      const data = await res.json().catch(() => null) as { error?: string } | null;
      if (!res.ok) {
        toast.error(data?.error ?? "Could not book the interview");
        return;
      }
      toast.success("Interview booked and added to Google Calendar");
      setOpen(false);
      setDate("");
      setTime("");
      setSelected([currentUserId]);
      router.refresh();
    });
  };

  return (
    <>
      <Button size="sm" icon="solar:calendar-add-broken" onClick={() => setOpen(true)}>
        Book interview
      </Button>

      <SimpleModal open={open} onClose={() => setOpen(false)} title="Book interview" icon="solar:calendar-add-broken">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-lo)]">Date</span>
              <DatePicker value={date} onChange={setDate} minDate={new Date()} placeholder="Select date" />
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-[var(--text-lo)]">Time</span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
              />
            </label>
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[var(--text-lo)]">Duration</span>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:outline-none"
            >
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">1 hour</option>
              <option value="90">1.5 hours</option>
            </select>
          </label>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-[var(--text-lo)]">Interviewers</legend>
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-1.5">
              {interviewers.map((person) => {
                const checked = selected.includes(person.id);
                const isSelf = person.id === currentUserId;
                return (
                  <label key={person.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-[var(--surface-2)]">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSelf}
                      onChange={() => toggle(person.id)}
                      className="h-4 w-4 accent-brand-500"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[var(--text-hi)]">{person.name}{isSelf ? " (you)" : ""}</span>
                      {person.job_title && <span className="block truncate text-[11px] text-[var(--text-lo)]">{person.job_title}</span>}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
          <p className="text-xs text-[var(--text-lo)]">
            The candidate and selected interviewers receive an invite through your connected Google Calendar.
          </p>
          <div className="flex justify-end">
            <Button icon="solar:calendar-add-broken" loading={isPending} onClick={save}>
              Book interview
            </Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
