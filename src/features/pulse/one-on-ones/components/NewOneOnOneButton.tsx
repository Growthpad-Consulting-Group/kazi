"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { DatePicker } from "@/components/ui/DatePicker";

interface Props {
  managerId: string;
  reports: { id: string; name: string; job_title: string | null }[];
  defaultReportId?: string;
}

export function NewOneOnOneButton({ managerId, reports, defaultReportId, size = "md" }: Props & { size?: "sm" | "md" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reportId, setReportId] = useState(defaultReportId ?? reports[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [calendar, setCalendar] = useState<{ loading: boolean; connected: boolean | null; name: string | null }>({ loading: false, connected: null, name: null });

  function openScheduler() {
    setReportId(defaultReportId ?? reports[0]?.id ?? "");
    setCalendar({ loading: true, connected: null, name: null });
    setOpen(true);
    void fetch("/api/integrations/google-calendar/status")
      .then((response) => response.json())
      .then((data: { connected?: boolean; calendar_name?: string | null }) => setCalendar({ loading: false, connected: Boolean(data.connected), name: data.calendar_name ?? null }))
      .catch(() => setCalendar({ loading: false, connected: false, name: null }));
  }

  async function create() {
    setSaving(true);
    const res = await fetch("/api/pulse/one-on-ones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId, reportId, scheduledAt: date ? `${date}T${time || "09:00"}` : null }),
    });
    const json = (await res.json().catch(() => null)) as { id?: string; error?: string } | null;
    setSaving(false);
    if (!res.ok || !json?.id) {
      toast.error(json?.error ?? "Could not schedule the 1-on-1.");
      return;
    }
    setOpen(false);
    router.push(`/pulse/one-on-ones/${json.id}`);
  }

  return (
    <>
      <Button size={size} icon="solar:calendar-add-broken" className="rounded-lg" onClick={openScheduler}>Schedule 1-on-1</Button>

      <SimpleModal open={open} onClose={() => setOpen(false)} title="Schedule 1-on-1" icon="solar:calendar-add-broken" maxWidth="max-w-sm">
          <div className="space-y-4">

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">With</label>
              <select
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 focus:ring-2 focus:ring-brand-500/30"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.job_title ? ` — ${r.job_title}` : ""}</option>
                ))}
              </select>
            </div>

            <div><label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">Date & time <span className="font-normal">(optional)</span></label><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px]"><DatePicker value={date} onChange={setDate} placeholder="Choose date" /><input type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={!date} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 disabled:cursor-not-allowed disabled:opacity-50" /></div>{date && !time && <p className="mt-1.5 text-[11px] text-[var(--text-lo)]">Defaults to 9:00 AM if no time is selected.</p>}</div>

            {calendar.loading ? <div className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2.5 text-xs text-[var(--text-lo)]"><Icon icon="solar:spinner-broken" className="h-4 w-4 animate-spin" />Checking Google Calendar…</div> : date && calendar.connected ? <div className="flex items-start gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs text-emerald-700 dark:text-emerald-400"><Icon icon="solar:calendar-check-broken" className="mt-0.5 h-4 w-4 shrink-0" /><p>This meeting will be added to {calendar.name ?? "your Google Calendar"} and both participants will receive an invite.</p></div> : calendar.connected === false ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-500/10 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300"><span className="flex min-w-0 items-start gap-2"><Icon icon="solar:calendar-remove-broken" className="mt-0.5 h-4 w-4 shrink-0" /><span>No Google Calendar is connected. This meeting will be saved in Kazi, but no calendar event or invite will be sent.</span></span><Button href="/api/integrations/google-calendar/connect" size="sm" variant="secondary">Connect calendar</Button></div> : null}

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button icon="solar:calendar-add-broken" loading={saving} disabled={!reportId} onClick={create}>{saving ? "Creating" : "Schedule"}</Button></div>
          </div>
      </SimpleModal>
    </>
  );
}
