"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";
import SignatureMediaPicker from "./SignatureMediaPicker";

type Domain = { id: string; name: string };
type Staff = {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
};
type Group = { id: string; name: string };
type Audience = "all" | "staff" | "staff_group" | "department";
const field =
  "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500";
const range: DateRangeValue = {
  startDate: null,
  endDate: null,
  label: "Custom Range",
};

export default function NewSignatureCampaignButton({
  domains,
  staff,
  groups,
}: {
  domains: Domain[];
  staff: Staff[];
  groups: Group[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [domainId, setDomainId] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [ids, setIds] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [schedule, setSchedule] = useState<DateRangeValue>(range);
  const departmentOptions = Array.from(
    new Set(staff.map((item) => item.department).filter(Boolean) as string[]),
  ).sort();
  const selected = (event: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(event.target.selectedOptions, (option) => option.value);
  const valid =
    audience === "all" || audience === "department"
      ? audience !== "department" || departments.length > 0
      : ids.length > 0;
  async function save() {
    if (!name || !imageUrl || !linkUrl || !valid) return;
    setSaving(true);
    try {
      const response = await fetch("/api/signatures/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          imageUrl,
          linkUrl,
          domainId: domainId || null,
          audienceType: audience,
          audienceIds: ids,
          audienceDepartments: departments,
          startsAt: schedule.startDate?.toISOString() ?? null,
          endsAt: schedule.endDate?.toISOString() ?? null,
          active: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error ?? "Could not create campaign.");
      toast.success("Campaign created");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create campaign.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <Button
        size="sm"
        icon="solar:add-circle-broken"
        onClick={() => setOpen(true)}
      >
        New campaign
      </Button>
      <SimpleModal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Build signature campaign"
        icon="solar:flag-2-broken"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-lo)]">
            Choose the staff audience, then sync their Gmail signatures to
            deploy this banner.
          </p>
          <label className="block text-sm font-medium text-[var(--text-hi)]">
            Campaign name
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={field}
            />
          </label>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setMediaOpen(true)}
            >
              Choose banner image
            </Button>
            {imageUrl && (
              <img
                src={imageUrl}
                alt=""
                className="mt-3 aspect-[2.5/1] w-full rounded-lg object-cover"
              />
            )}
          </div>
          <label className="block text-sm font-medium text-[var(--text-hi)]">
            Destination URL
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              className={field}
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Audience type
              <select
                value={audience}
                onChange={(event) => {
                  setAudience(event.target.value as Audience);
                  setIds([]);
                  setDepartments([]);
                }}
                className={field}
              >
                <option value="all">All signature staff</option>
                <option value="staff">Selected staff</option>
                <option value="staff_group">Staff groups</option>
                <option value="department">Departments</option>
              </select>
            </label>
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Domain constraint{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
              <select
                value={domainId}
                onChange={(event) => setDomainId(event.target.value)}
                className={field}
              >
                <option value="">All managed domains</option>
                {domains.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {audience === "staff" && (
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Select staff{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Hold ⌘ / Ctrl for several
              </span>
              <select
                multiple
                value={ids}
                onChange={(event) => setIds(selected(event))}
                className={field + " h-32"}
              >
                {staff.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name} · {item.email}
                  </option>
                ))}
              </select>
            </label>
          )}
          {audience === "staff_group" && (
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Select staff groups{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Hold ⌘ / Ctrl for several
              </span>
              <select
                multiple
                value={ids}
                onChange={(event) => setIds(selected(event))}
                className={field + " h-28"}
              >
                {groups.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {audience === "department" && (
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Select departments{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Hold ⌘ / Ctrl for several
              </span>
              <select
                multiple
                value={departments}
                onChange={(event) => setDepartments(selected(event))}
                className={field + " h-28"}
              >
                {departmentOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div>
            <p className="text-sm font-medium text-[var(--text-hi)]">
              Campaign schedule{" "}
              <span className="font-normal text-[var(--text-lo)]">
                Optional
              </span>
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
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!name || !imageUrl || !linkUrl || !valid}
            loading={saving}
            onClick={save}
          >
            Create campaign
          </Button>
        </div>
      </SimpleModal>
      <SignatureMediaPicker
        isOpen={mediaOpen}
        onClose={() => setMediaOpen(false)}
        onSelect={(url) => {
          setImageUrl(url);
          setMediaOpen(false);
        }}
      />
    </>
  );
}
