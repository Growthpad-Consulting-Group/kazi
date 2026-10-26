"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import type { RewardCatalogue } from "@/types/database";

type StaffOption = { id: string; name: string };

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500/60";
const labelClass = "block text-xs font-semibold text-[var(--text-hi)]";

async function send(url: string, method: string, body: unknown) {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new Error(data?.error ?? "Something went wrong.");
}

function RewardForm({ item, onDone }: { item?: RewardCatalogue; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [pointsCost, setPointsCost] = useState(String(item?.points_cost ?? ""));
  const [imageUrl, setImageUrl] = useState(item?.image_url ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/pulse/rewards/catalogue/image", { method: "POST", body: form });
      const data = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!response.ok || !data?.url) throw new Error(data?.error ?? "Could not upload the image.");
      setImageUrl(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload the image.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    try {
      const payload = { name, description, points_cost: Number(pointsCost), image_url: imageUrl };
      if (item) await send(`/api/pulse/rewards/catalogue/${item.id}`, "PATCH", payload);
      else await send("/api/pulse/rewards/catalogue", "POST", payload);
      toast.success(item ? "Reward updated" : "Reward added");
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the reward.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <p className="text-xs font-semibold text-[var(--text-hi)]">{item ? `Edit ${item.name}` : "Add a reward"}</p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <label className={labelClass}>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} className={inputClass} /></label>
        <label className={labelClass}>Points cost<input type="number" min={1} value={pointsCost} onChange={(e) => setPointsCost(e.target.value)} className={inputClass} /></label>
      </div>
      <label className={labelClass}>Description <span className="font-normal text-[var(--text-lo)]">Optional</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} resize-y`} />
      </label>
      <div>
        <p className={labelClass}>Image <span className="font-normal text-[var(--text-lo)]">Optional</span></p>
        <div className="mt-1.5 flex items-center gap-3">
          {imageUrl ? (
            <img src={imageUrl} alt="Reward preview" className="h-16 w-16 rounded-xl border border-[var(--border)] object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-[var(--border)] text-[var(--text-lo)]"><Icon icon="solar:gallery-broken" className="h-5 w-5" /></span>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon="solar:upload-broken" loading={uploading} onClick={() => fileRef.current?.click()}>
              {imageUrl ? "Replace image" : "Upload image"}
            </Button>
            {imageUrl && <Button size="sm" variant="secondary" onClick={() => setImageUrl("")}>Remove</Button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadImage} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {item && <Button variant="secondary" onClick={onDone}>Cancel</Button>}
        <Button loading={saving} disabled={!name.trim() || !Number(pointsCost)} onClick={save}>{item ? "Save changes" : "Add reward"}</Button>
      </div>
    </div>
  );
}

function CatalogueManager({ items }: { items: RewardCatalogue[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<RewardCatalogue | null>(null);
  const [adding, setAdding] = useState(false);

  async function toggle(item: RewardCatalogue) {
    try {
      await send(`/api/pulse/rewards/catalogue/${item.id}`, "PATCH", { is_active: !item.is_active });
      toast.success(item.is_active ? "Reward hidden from staff" : "Reward shown to staff");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the reward.");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-lo)]">Rewards that are hidden stay on record for past redemptions but can't be redeemed.</p>
      {adding || editing ? (
        <RewardForm item={editing ?? undefined} onDone={() => { setAdding(false); setEditing(null); }} />
      ) : (
        <Button size="sm" icon="solar:add-circle-broken" onClick={() => setAdding(true)}>Add a reward</Button>
      )}
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--text-lo)]">No rewards yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-semibold ${item.is_active ? "text-[var(--text-hi)]" : "text-[var(--text-lo)] line-through"}`}>{item.name}</p>
                {item.description && <p className="truncate text-xs text-[var(--text-lo)]">{item.description}</p>}
              </div>
              <span className="shrink-0 rounded-lg bg-brand-500/10 px-2 py-1 font-mono text-xs font-bold text-brand-500">{item.points_cost} pts</span>
              <button type="button" onClick={() => toggle(item)} className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold ${item.is_active ? "bg-emerald-500/10 text-emerald-600" : "bg-[var(--surface-2)] text-[var(--text-lo)]"}`}>
                {item.is_active ? "Active" : "Hidden"}
              </button>
              <button type="button" onClick={() => { setAdding(false); setEditing(item); }} aria-label="Edit reward" className="rounded-lg p-1.5 text-[var(--text-lo)] hover:bg-[var(--surface-2)] hover:text-brand-500">
                <Icon icon="solar:pen-broken" className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GrantPoints({ staff }: { staff: StaffOption[] }) {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function grant() {
    setSaving(true);
    try {
      await send("/api/pulse/rewards/grant", "POST", { user_id: userId, points: Number(points), reason });
      toast.success("Points granted");
      setPoints("");
      setReason("");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not grant points.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--text-lo)]">Add points to someone's balance for a reason that isn't a recognition, such as an off-platform win. The reason is shown in their history.</p>
      <label className={labelClass}>Person
        <select value={userId} onChange={(e) => setUserId(e.target.value)} className={inputClass}>
          <option value="">Choose a person</option>
          {staff.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
        <label className={labelClass}>Points<input type="number" min={1} max={10000} value={points} onChange={(e) => setPoints(e.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Reason<input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} placeholder="e.g. Team offsite award" className={inputClass} /></label>
      </div>
      <div className="flex justify-end">
        <Button loading={saving} disabled={!userId || !Number(points) || !reason.trim()} onClick={grant}>Grant points</Button>
      </div>
    </div>
  );
}

export function AdminRewardTools({ catalogue, staff }: { catalogue: RewardCatalogue[]; staff: StaffOption[] }) {
  const [view, setView] = useState<"catalogue" | "grant" | null>(null);
  return (
    <>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="secondary" icon="solar:gift-broken" onClick={() => setView("catalogue")}>Manage rewards</Button>
        <Button size="sm" icon="solar:star-broken" onClick={() => setView("grant")}>Grant points</Button>
      </div>
      <SimpleModal open={view === "catalogue"} onClose={() => setView(null)} title="Manage rewards" icon="solar:gift-broken" maxWidth="max-w-2xl">
        {view === "catalogue" && <CatalogueManager items={catalogue} />}
      </SimpleModal>
      <SimpleModal open={view === "grant"} onClose={() => setView(null)} title="Grant points" icon="solar:star-broken" maxWidth="max-w-lg">
        {view === "grant" && <GrantPoints staff={staff} />}
      </SimpleModal>
    </>
  );
}
