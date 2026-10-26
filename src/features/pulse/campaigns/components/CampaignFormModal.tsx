"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import DateRangePicker from "@/components/ui/DateRangePicker";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import type { Database } from "@/types/database";
import type { AudienceOptions } from "@/features/pulse/side-quests/components/SideQuestFormModal";

type Campaign = Database["public"]["Tables"]["recognition_campaigns"]["Row"];
type ValueOption = { id: string; name: string };

const AUDIENCES = [
  { value: "company", label: "Company-wide" },
  { value: "department", label: "Department" },
  { value: "location", label: "Location" },
  { value: "manager_group", label: "Manager group" },
  { value: "staff", label: "Selected staff" },
];

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-normal text-[var(--text-hi)] outline-none focus:border-brand-500/60";

function toDateValue(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

function CampaignForm({ campaign, values, options, onDone }: { campaign?: Campaign; values: ValueOption[]; options: AudienceOptions; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(campaign?.name ?? "");
  const [goal, setGoal] = useState(campaign?.goal ?? "");
  const [audience, setAudience] = useState<Campaign["audience_type"]>(campaign?.audience_type ?? "company");
  const [startsAt, setStartsAt] = useState(campaign?.starts_at ? toDateValue(new Date(campaign.starts_at)) : "");
  const [endsAt, setEndsAt] = useState(campaign?.ends_at ? toDateValue(new Date(campaign.ends_at)) : "");
  const [valueIds, setValueIds] = useState<string[]>(campaign?.value_ids ?? []);
  const [filters, setFilters] = useState<string[]>(campaign?.audience_filters ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const targets =
    audience === "department" ? options.departments.map((value) => ({ value, label: value }))
    : audience === "location" ? options.locations.map((value) => ({ value, label: value }))
    : audience === "manager_group" ? options.managers.map((value) => ({ value: value.id, label: value.name }))
    : audience === "staff" ? options.staff.map((value) => ({ value: value.id, label: value.name }))
    : [];

  const dateRange = {
    startDate: startsAt ? new Date(`${startsAt}T12:00:00`) : null,
    endDate: endsAt ? new Date(`${endsAt}T12:00:00`) : null,
  };

  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(campaign ? `/api/pulse/campaigns/${campaign.id}` : "/api/pulse/campaigns", {
        method: campaign ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, goal, audience_type: audience, audience_filters: filters, starts_at: startsAt || null, ends_at: endsAt || null, value_ids: valueIds }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not save the campaign.");
      toast.success(campaign ? "Campaign updated" : "Campaign created");
      onDone();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    if (!campaign) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!response.ok) throw new Error("Could not archive the campaign.");
      toast.success("Campaign archived");
      onDone();
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not archive the campaign.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <label className="block text-xs font-semibold text-[var(--text-hi)]">
        Campaign name
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Celebrate great client work" className={inputClass} />
      </label>
      <label className="block text-xs font-semibold text-[var(--text-hi)]">
        Goal <span className="font-normal text-[var(--text-lo)]">Optional</span>
        <textarea rows={3} value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="What behaviour or moment are you trying to make visible?" className={`${inputClass} resize-y`} />
      </label>
      <div>
        <p className="text-xs font-semibold text-[var(--text-hi)]">Campaign window <span className="font-normal text-[var(--text-lo)]">Optional</span></p>
        <div className="mt-1.5">
          <DateRangePicker
            value={dateRange}
            onChange={(range) => {
              setStartsAt(range.startDate ? toDateValue(range.startDate) : "");
              setEndsAt(range.endDate ? toDateValue(range.endDate) : "");
            }}
            allowedRanges={["Custom Range"]}
            maxDate={null}
            fullWidth
          />
        </div>
      </div>
      <label className="block text-xs font-semibold text-[var(--text-hi)]">
        Audience
        <select value={audience} onChange={(event) => { setAudience(event.target.value as Campaign["audience_type"]); setFilters([]); }} className={inputClass}>
          {AUDIENCES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {audience !== "company" && (
        <label className="block text-xs font-semibold text-[var(--text-hi)]">
          Choose eligible {audience === "staff" ? "staff" : audience === "manager_group" ? "manager groups" : audience}s
          <select multiple size={Math.min(Math.max(targets.length, 3), 5)} value={filters} onChange={(event) => setFilters(Array.from(event.target.selectedOptions, (option) => option.value))} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-normal text-[var(--text-hi)]">
            {targets.map((target) => <option key={target.value} value={target.value}>{target.label}</option>)}
          </select>
        </label>
      )}
      {values.length > 0 && (
        <fieldset>
          <legend className="text-xs font-semibold text-[var(--text-hi)]">Values to highlight</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {values.map((value) => (
              <button
                key={value.id}
                type="button"
                onClick={() => setValueIds((current) => (current.includes(value.id) ? current.filter((id) => id !== value.id) : [...current, value.id]))}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${valueIds.includes(value.id) ? "bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/25" : "bg-[var(--surface-2)] text-[var(--text-lo)]"}`}
              >
                {value.name}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
        {campaign && campaign.status !== "archived" ? (
          <Button variant="danger" disabled={saving} onClick={archive}>Archive campaign</Button>
        ) : <span />}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>Cancel</Button>
          <Button loading={saving} disabled={!name.trim() || (audience !== "company" && !filters.length)} onClick={save}>{campaign ? "Save changes" : "Create campaign"}</Button>
        </div>
      </div>
    </div>
  );
}

export function NewCampaignButton({ values, options }: { values: ValueOption[]; options: AudienceOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" icon="solar:add-circle-broken" onClick={() => setOpen(true)}>New campaign</Button>
      <SimpleModal open={open} onClose={() => setOpen(false)} title="New recognition campaign" icon="solar:flag-2-broken" maxWidth="max-w-lg">
        {open && <CampaignForm values={values} options={options} onDone={() => setOpen(false)} />}
      </SimpleModal>
    </>
  );
}

export function EditCampaignButton({ campaign, values, options }: { campaign: Campaign; values: ValueOption[]; options: AudienceOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Edit campaign" title="Edit campaign" className="rounded-lg p-1.5 text-[var(--text-lo)] transition-colors hover:bg-[var(--surface-2)] hover:text-brand-500">
        <Icon icon="solar:pen-broken" className="h-4 w-4" />
      </button>
      <SimpleModal open={open} onClose={() => setOpen(false)} title="Edit recognition campaign" icon="solar:pen-broken" maxWidth="max-w-lg">
        {open && <CampaignForm campaign={campaign} values={values} options={options} onDone={() => setOpen(false)} />}
      </SimpleModal>
    </>
  );
}
