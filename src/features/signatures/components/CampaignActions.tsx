"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import DateRangePicker, { type DateRangeValue } from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";

type Domain = { id: string; name: string };
type Campaign = { id: string; name: string; image_url: string; link_url: string; active: boolean; domain_id: string | null; variant_label: string | null; weight: number; starts_at: string | null; ends_at: string | null };
type Staff = { id: string; full_name: string; email: string; department: string | null };
type Group = { id: string; name: string };
type Audience = { campaign_id: string; audience_type: "staff" | "staff_group" | "department"; staff_profile_id: string | null; staff_group_id: string | null; department: string | null };
type AudienceType = "all" | "staff" | "staff_group" | "department";

export default function CampaignActions({ campaign, domains, staff, groups, audiences }: { campaign: Campaign; domains: Domain[]; staff: Staff[]; groups: Group[]; audiences: Audience[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(campaign.name);
  const [linkUrl, setLinkUrl] = useState(campaign.link_url);
  const [domainId, setDomainId] = useState(campaign.domain_id ?? "");
  const [variantLabel, setVariantLabel] = useState(campaign.variant_label ?? "");
  const [weight, setWeight] = useState(campaign.weight);
  const [active, setActive] = useState(campaign.active);
  const [schedule, setSchedule] = useState<DateRangeValue>({ startDate: campaign.starts_at ? new Date(campaign.starts_at) : null, endDate: campaign.ends_at ? new Date(campaign.ends_at) : null, label: "Custom Range" });
  const existingAudiences = audiences.filter((audience) => audience.campaign_id === campaign.id);
  const inferredAudienceType: AudienceType = existingAudiences[0]?.audience_type ?? "all";
  const [audienceType, setAudienceType] = useState<AudienceType>(inferredAudienceType);
  const [audienceIds, setAudienceIds] = useState<string[]>(existingAudiences.map((audience) => audience.audience_type === "staff" ? audience.staff_profile_id : audience.staff_group_id).filter((id): id is string => Boolean(id)));
  const [audienceDepartment, setAudienceDepartment] = useState(existingAudiences[0]?.department ?? "");
  const departments = Array.from(new Set(staff.map((person) => person.department).filter(Boolean) as string[])).sort();

  async function request(method: "PATCH" | "DELETE", body?: Record<string, unknown>) {
    const response = await fetch(`/api/signatures/campaigns/${campaign.id}`, { method, headers: body ? { "content-type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error ?? "Could not update campaign.");
  }
  async function save() {
    setSaving(true);
    try { await request("PATCH", { name, linkUrl, domainId: domainId || null, variantLabel, weight, active, startsAt: schedule.startDate?.toISOString() ?? null, endsAt: schedule.endDate?.toISOString() ?? null }); toast.success("Campaign updated"); setEditOpen(false); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update campaign."); } finally { setSaving(false); }
  }
  async function toggle() {
    setSaving(true);
    try { await request("PATCH", { active: !campaign.active }); toast.success(campaign.active ? "Campaign paused" : "Campaign activated"); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update campaign."); } finally { setSaving(false); }
  }
  async function remove() {
    setSaving(true);
    try { await request("DELETE"); toast.success("Campaign deleted"); setDeleteOpen(false); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not delete campaign."); } finally { setSaving(false); }
  }
  async function saveAudience() { setSaving(true); try { await request("PATCH", { audienceType, audienceIds, audienceDepartment }); toast.success("Campaign audience updated"); setAudienceOpen(false); router.refresh(); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update campaign audience."); } finally { setSaving(false); } }
  function selectAudience(event: React.ChangeEvent<HTMLSelectElement>) { setAudienceIds(Array.from(event.target.selectedOptions, (option) => option.value)); }
  const validAudience = audienceType === "all" || audienceType === "department" ? audienceType !== "department" || Boolean(audienceDepartment) : audienceIds.length > 0;
  return <><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="secondary" icon="solar:users-group-rounded-broken" onClick={() => setAudienceOpen(true)}>Audience</Button><Button size="sm" variant="secondary" icon="solar:pen-new-square-broken" onClick={() => setEditOpen(true)}>Edit</Button><Button size="sm" variant="secondary" icon={campaign.active ? "solar:pause-circle-broken" : "solar:play-circle-broken"} loading={saving} onClick={toggle}>{campaign.active ? "Pause" : "Activate"}</Button><Button size="sm" variant="danger" icon="solar:trash-bin-trash-broken" onClick={() => setDeleteOpen(true)}>Delete</Button></div><SimpleModal open={audienceOpen} onClose={() => !saving && setAudienceOpen(false)} title={`Audience · ${campaign.name}`} icon="solar:users-group-rounded-broken"><p className="text-sm text-[var(--text-lo)]">Target the campaign to everyone, selected staff, a saved staff group, or a department.</p><div className="mt-4 space-y-4"><label className="block text-sm font-medium text-[var(--text-hi)]">Audience type<select value={audienceType} onChange={(event) => { setAudienceType(event.target.value as AudienceType); setAudienceIds([]); setAudienceDepartment(""); }} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm"><option value="all">All signature staff</option><option value="staff">Selected staff</option><option value="staff_group">Staff group</option><option value="department">Department</option></select></label>{audienceType === "staff" && <label className="block text-sm font-medium text-[var(--text-hi)]">Select staff<select multiple value={audienceIds} onChange={selectAudience} className="mt-1.5 h-32 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm">{staff.map((person) => <option key={person.id} value={person.id}>{person.full_name} · {person.email}</option>)}</select></label>}{audienceType === "staff_group" && <label className="block text-sm font-medium text-[var(--text-hi)]">Select groups<select multiple value={audienceIds} onChange={selectAudience} className="mt-1.5 h-28 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm">{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>}{audienceType === "department" && <label className="block text-sm font-medium text-[var(--text-hi)]">Department<select value={audienceDepartment} onChange={(event) => setAudienceDepartment(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm"><option value="">Choose department</option>{departments.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>}</div><div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button variant="secondary" onClick={() => setAudienceOpen(false)}>Cancel</Button><Button disabled={!validAudience} loading={saving} icon="solar:check-circle-broken" onClick={saveAudience}>Save audience</Button></div></SimpleModal><SimpleModal open={editOpen} onClose={() => !saving && setEditOpen(false)} title={`Edit ${campaign.name}`} icon="solar:pen-new-square-broken" maxWidth="max-w-xl"><div className="space-y-4"><label className="block text-sm font-medium text-[var(--text-hi)]">Campaign name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label><label className="block text-sm font-medium text-[var(--text-hi)]">Destination URL<input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-[var(--text-hi)]">Domain constraint<select value={domainId} onChange={(event) => setDomainId(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500"><option value="">All managed signature domains</option>{domains.map((domain) => <option key={domain.id} value={domain.id}>{domain.name} only</option>)}</select></label><label className="block text-sm font-medium text-[var(--text-hi)]">Rotation weight<input type="number" min={1} max={100} value={weight} onChange={(event) => setWeight(Math.max(1, Number(event.target.value) || 1))} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label><label className="block text-sm font-medium text-[var(--text-hi)]">Label <span className="font-normal text-[var(--text-lo)]">Optional</span><input value={variantLabel} onChange={(event) => setVariantLabel(event.target.value)} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand-500" /></label><div><p className="text-sm font-medium text-[var(--text-hi)]">Schedule</p><DateRangePicker value={schedule} onChange={setSchedule} maxDate={null} fullWidth allowedRanges={["Today", "This Week", "Next Week", "This Month", "Next Month", "Custom Range"]} className="mt-1.5" /></div></div><label className="flex items-center gap-2 text-sm font-medium text-[var(--text-hi)]"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-[#f05d23]" />Campaign is active</label></div><div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4"><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button loading={saving} icon="solar:diskette-broken" onClick={save}>Save changes</Button></div></SimpleModal><SimpleModal open={deleteOpen} onClose={() => !saving && setDeleteOpen(false)} title="Delete campaign?" icon="solar:danger-triangle-broken"><p className="text-sm leading-6 text-[var(--text-lo)]">This permanently deletes the banner and its reporting history. Existing Gmail signatures keep the banner until each mailbox is synced again.</p><div className="mt-5 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" loading={saving} icon="solar:trash-bin-trash-broken" onClick={remove}>Delete campaign</Button></div></SimpleModal></>;
}
