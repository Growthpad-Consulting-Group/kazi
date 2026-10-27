"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import StatCard from "@/components/ui/StatCard";
import toast from "react-hot-toast";
import { saveCompanySettings, type CompanySettings } from "../actions";
import SettingsSection from "./SettingsSection";
import { Button } from "@/components/ui/Button";
import AvatarUpload from "@/components/ui/AvatarUpload";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

const TIMEZONES = [
  "Africa/Nairobi", "Africa/Lagos", "Africa/Accra", "Africa/Johannesburg",
  "Africa/Cairo", "Africa/Casablanca", "Africa/Abidjan",
  "Europe/London", "Europe/Paris", "Europe/Berlin",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore",
  "Australia/Sydney", "Pacific/Auckland",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const INDUSTRIES = [
  "Technology", "Finance & Banking", "Healthcare", "Education",
  "Retail & E-commerce", "Manufacturing", "Media & Entertainment",
  "Consulting & Professional Services", "Non-profit", "Government",
  "Real Estate", "Agriculture", "Energy", "Logistics & Transport", "Other",
];

const SIZES = ["1–10", "11–50", "51–200", "201–500", "501–1,000", "1,001–5,000", "5,000+"];

interface Props {
  initial: CompanySettings;
  orgStats: { staff: number; departments: number; jobs: number; candidates: number };
}

export default function CompanySettingsClient({ initial, orgStats }: Props) {
  const router = useRouter();
  const [fields, setFields] = useState<CompanySettings>({ ...initial });
  const [isPending, startTransition] = useTransition();

  const set = <K extends keyof CompanySettings>(k: K, v: CompanySettings[K]) =>
    setFields((f) => ({ ...f, [k]: v }));

  const dirty = JSON.stringify(fields) !== JSON.stringify(initial);

  function save() {
    startTransition(async () => {
      try {
        await saveCompanySettings(fields);
        toast.success("Company settings saved");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Identity */}
      <SettingsSection title="Company identity" description="Shown in exports, signatures, and the header" icon="solar:buildings-broken">
        <div className="pb-5 border-b border-[var(--border)]">
          <AvatarUpload
            value={fields.logo_url ?? ""}
            name={fields.company_name ?? "C"}
            uploadEndpoint="/api/company/logo"
            onChange={(url) => set("logo_url", url || null)}
            size="lg"
          />
          <p className="mt-2 text-xs text-[var(--text-lo)]">Or paste a URL below. Used in email signatures and exported documents.</p>
        </div>

        <div className="pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Company name</span>
            <input
              value={fields.company_name ?? ""}
              onChange={(e) => set("company_name", e.target.value || null)}
              placeholder="e.g. Growthpad Consulting Co."
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Website</span>
            <input
              value={fields.website ?? ""}
              onChange={(e) => set("website", e.target.value || null)}
              placeholder="https://growthpad.africa"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Country / HQ</span>
            <input
              value={fields.country ?? ""}
              onChange={(e) => set("country", e.target.value || null)}
              placeholder="e.g. Kenya"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Industry</span>
            <select value={fields.industry ?? ""} onChange={(e) => set("industry", e.target.value || null)} className={inputCls}>
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Company size</span>
            <select value={fields.company_size ?? ""} onChange={(e) => set("company_size", e.target.value || null)} className={inputCls}>
              <option value="">Select size</option>
              {SIZES.map((s) => <option key={s} value={s}>{s} employees</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Logo URL</span>
            <input
              value={fields.logo_url ?? ""}
              onChange={(e) => set("logo_url", e.target.value || null)}
              placeholder="https://…"
              className={inputCls}
            />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title="Culture participation" description="Choose whether Kazi may show organisation-wide participation leaderboards" icon="solar:cup-star-broken" iconBg="bg-amber-500/10 text-amber-600">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--surface-2)] p-3.5">
          <input type="checkbox" checked={fields.culture_leaderboards_enabled} onChange={(event) => set("culture_leaderboards_enabled", event.target.checked)} className="mt-0.5 rounded" />
          <span><span className="block text-sm font-semibold text-[var(--text-hi)]">Enable culture leaderboards</span><span className="mt-1 block text-xs leading-relaxed text-[var(--text-lo)]">Show recognition and Side Quest participation rankings. Keep this off when your culture prefers private participation.</span></span>
        </label>
      </SettingsSection>

      {/* Locale */}
      <SettingsSection title="Locale & calendar" description="Affects dates, reports, and review cycles" icon="solar:calendar-mark-broken" iconBg="bg-blue-500/10 text-blue-500">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Timezone</span>
            <select value={fields.timezone} onChange={(e) => set("timezone", e.target.value)} className={inputCls}>
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Fiscal year starts</span>
            <select value={fields.fiscal_year_start} onChange={(e) => set("fiscal_year_start", Number(e.target.value))} className={inputCls}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
        </div>
      </SettingsSection>

      {/* Org snapshot */}
      <SettingsSection title="Organisation snapshot" description="Current record counts across Kazi" icon="solar:chart-square-broken" iconBg="bg-emerald-500/10 text-emerald-600">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard variant="flat" compact title="Staff" value={orgStats.staff} icon="solar:users-group-rounded-broken" color="orange" />
          <StatCard variant="flat" compact title="Departments" value={orgStats.departments} icon="solar:buildings-broken" color="blue" />
          <StatCard variant="flat" compact title="Open jobs" value={orgStats.jobs} icon="solar:case-broken" color="green" />
          <StatCard variant="flat" compact title="Candidates" value={orgStats.candidates} icon="solar:user-plus-rounded-broken" color="amber" />
        </div>
      </SettingsSection>

      {/* Platform info — read-only */}
      <SettingsSection title="Platform" description="Infrastructure and compliance information" icon="solar:info-circle-broken" iconBg="bg-slate-500/10 text-slate-500">
        <div className="divide-y divide-[var(--border)]">
          {[
            { label: "Platform", value: "Kazi by Growthpad" },
            { label: "Region", value: "Africa (Nairobi + Accra)" },
            { label: "Compliance", value: "ODPC Kenya · GDPR-aligned" },
            { label: "Data residency", value: "Supabase EU-West" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="text-xs text-[var(--text-lo)]">{label}</span>
              <span className="text-xs font-medium text-[var(--text-hi)]">{value}</span>
            </div>
          ))}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <Button icon="solar:diskette-broken" loading={isPending} disabled={!dirty} onClick={save}>
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
