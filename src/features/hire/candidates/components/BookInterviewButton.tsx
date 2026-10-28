"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { InterviewerPicker, type InterviewerOption } from "./InterviewerPicker";

export type ScheduledInterview = { id: string; scheduled_at: string; duration_minutes: number };

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
  const [calendar, setCalendar] = useState<{ loading: boolean; connected: boolean | null; name: string | null }>({ loading: false, connected: null, name: null });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("calendar") !== "connected" || params.get("resume") !== "interview") return;

    params.delete("calendar");
    params.delete("resume");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    window.requestAnimationFrame(() => {
      setCalendar({ loading: true, connected: null, name: null });
      setOpen(true);
      toast.success("Google Calendar connected. You can book the interview now.");
      void fetch("/api/integrations/google-calendar/status")
        .then((response) => response.json())
        .then((data: { connected?: boolean; calendar_name?: string | null }) => setCalendar({ loading: false, connected: Boolean(data.connected), name: data.calendar_name ?? null }))
        .catch(() => setCalendar({ loading: false, connected: false, name: null }));
    });
  }, []);

  function openBooking() {
    setCalendar({ loading: true, connected: null, name: null });
    setOpen(true);
    void fetch("/api/integrations/google-calendar/status")
      .then((response) => response.json())
      .then((data: { connected?: boolean; calendar_name?: string | null }) => setCalendar({ loading: false, connected: Boolean(data.connected), name: data.calendar_name ?? null }))
      .catch(() => setCalendar({ loading: false, connected: false, name: null }));
  }

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

  function connectCalendar() {
    const returnTo = new URL(window.location.href);
    returnTo.searchParams.set("resume", "interview");
    // OAuth must begin as a document navigation so Google can take over the request.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/api/integrations/google-calendar/connect?returnTo=${encodeURIComponent(`${returnTo.pathname}${returnTo.search}`)}`;
  }

  return (
    <>
      <Button size="sm" icon="solar:calendar-add-broken" onClick={openBooking}>
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
          <InterviewerPicker interviewers={interviewers} selected={selected} currentUserId={currentUserId} onToggle={toggle} />
          {calendar.loading ? <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--text-lo)]"><Icon icon="solar:spinner-broken" className="h-4 w-4 animate-spin" />Checking Google Calendar…</div> : calendar.connected ? <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400"><Icon icon="solar:calendar-check-broken" className="mt-0.5 h-4 w-4 shrink-0" /><p>The candidate and selected interviewers will receive an invite through {calendar.name ?? "your connected Google Calendar"}.</p></div> : calendar.connected === false ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300"><span className="flex min-w-0 items-start gap-2"><Icon icon="solar:calendar-remove-broken" className="mt-0.5 h-4 w-4 shrink-0" /><span>Connect Google Calendar before booking so Kazi can create the interview event and send invitations.</span></span><Button onClick={connectCalendar} size="sm" variant="secondary">Connect calendar</Button></div> : null}
          <div className="flex justify-end">
            <Button icon="solar:calendar-add-broken" loading={isPending} disabled={calendar.loading || calendar.connected === false} onClick={save}>
              Book interview
            </Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}

function localDateValue(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function localTimeValue(iso: string) {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(11, 16);
}

export function InterviewActions({ candidateId, interview }: { candidateId: string; interview: ScheduledInterview }) {
  const router = useRouter();
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [date, setDate] = useState(() => localDateValue(interview.scheduled_at));
  const [time, setTime] = useState(() => localTimeValue(interview.scheduled_at));
  const [duration, setDuration] = useState(String(interview.duration_minutes));
  const [saving, setSaving] = useState(false);

  async function reschedule() {
    if (!date || !time) {
      toast.error("Choose a date and time");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/hire/candidates/${candidateId}/interviews/${interview.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: new Date(`${date}T${time}`).toISOString(), durationMinutes: Number(duration) }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not reschedule the interview");
      toast.success("Interview and calendar invite updated.");
      setRescheduleOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not reschedule the interview");
    } finally {
      setSaving(false);
    }
  }

  async function cancel() {
    setSaving(true);
    try {
      const response = await fetch(`/api/hire/candidates/${candidateId}/interviews/${interview.id}`, { method: "DELETE" });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? "Could not cancel the interview");
      toast.success("Interview and calendar invite cancelled.");
      setCancelOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel the interview");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => setRescheduleOpen(true)} className="rounded-lg p-1.5 text-[var(--text-lo)] transition hover:bg-brand-500/10 hover:text-brand-500" aria-label="Reschedule interview"><Icon icon="solar:pen-new-square-broken" className="h-4 w-4" /></button>
      <button type="button" onClick={() => setCancelOpen(true)} className="rounded-lg p-1.5 text-[var(--text-lo)] transition hover:bg-red-500/10 hover:text-red-500" aria-label="Cancel interview"><Icon icon="solar:trash-bin-minimalistic-broken" className="h-4 w-4" /></button>
    </div>

    <SimpleModal open={rescheduleOpen} onClose={() => !saving && setRescheduleOpen(false)} title="Reschedule interview" icon="solar:calendar-broken" maxWidth="max-w-sm">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><span className="text-xs font-medium text-[var(--text-lo)]">Date</span><DatePicker value={date} onChange={setDate} minDate={new Date()} /></div>
          <label className="block space-y-1.5"><span className="text-xs font-medium text-[var(--text-lo)]">Time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30" /></label>
        </div>
        <label className="block space-y-1.5"><span className="text-xs font-medium text-[var(--text-lo)]">Duration</span><select value={duration} onChange={(event) => setDuration(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option></select></label>
        <p className="rounded-xl bg-brand-500/10 px-3 py-2.5 text-xs leading-relaxed text-[var(--text-hi)]">The candidate and interviewers will receive the updated Google Calendar invitation.</p>
        <div className="flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setRescheduleOpen(false)}>Cancel</Button><Button icon="solar:calendar-mark-broken" loading={saving} onClick={reschedule}>Update interview</Button></div>
      </div>
    </SimpleModal>

    <SimpleModal open={cancelOpen} onClose={() => !saving && setCancelOpen(false)} title="Cancel interview" icon="solar:danger-triangle-broken" maxWidth="max-w-sm">
      <div className="space-y-4"><p className="text-sm leading-relaxed text-[var(--text-lo)]">This removes the interview from Kazi and cancels its Google Calendar event for the candidate and interviewers.</p><div className="flex justify-end gap-2"><Button variant="secondary" disabled={saving} onClick={() => setCancelOpen(false)}>Keep interview</Button><Button loading={saving} onClick={cancel} className="bg-red-500 text-white hover:bg-red-600">Cancel interview</Button></div></div>
    </SimpleModal>
  </>;
}
