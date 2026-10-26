"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  async function create() {
    setSaving(true);
    const res = await fetch("/api/pulse/one-on-ones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId, reportId, scheduledAt: date ? `${date}T${time || "09:00"}` : null }),
    });
    const json = await res.json();
    setSaving(false);
    setOpen(false);
    if (json.id) router.push(`/pulse/one-on-ones/${json.id}`);
  }

  return (
    <>
      <Button size={size} icon="solar:calendar-add-broken" className="rounded-lg" onClick={() => { setReportId(defaultReportId ?? reports[0]?.id ?? ""); setOpen(true); }}>Schedule 1-on-1</Button>

      <SimpleModal open={open} onClose={() => setOpen(false)} title="Schedule 1-on-1" icon="solar:calendar-add-broken" maxWidth="max-w-sm">
          <div className="space-y-4">

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">With</label>
              <select
                value={reportId}
                onChange={(e) => setReportId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}{r.job_title ? ` — ${r.job_title}` : ""}</option>
                ))}
              </select>
            </div>

            <div><label className="mb-1 block text-xs font-medium text-[var(--text-lo)]">Date & time <span className="font-normal">(optional)</span></label><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_112px]"><DatePicker value={date} onChange={setDate} placeholder="Choose date" /><input type="time" value={time} onChange={(event) => setTime(event.target.value)} disabled={!date} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60 disabled:cursor-not-allowed disabled:opacity-50" /></div>{date && !time && <p className="mt-1.5 text-[11px] text-[var(--text-lo)]">Defaults to 9:00 AM if no time is selected.</p>}</div>

            <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button icon="solar:calendar-add-broken" loading={saving} disabled={!reportId} onClick={create}>{saving ? "Creating" : "Schedule"}</Button></div>
          </div>
      </SimpleModal>
    </>
  );
}
