"use client";
import { useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { Button } from "@/components/ui/Button";

type Domain = { id: string; name: string; platform: string; gateway_status: string; spf_verified: boolean; dkim_verified: boolean; notes: string | null };

const EMPTY_NEW = { name: "", platform: "google_workspace" };

export default function DomainsClient({ domains }: { domains: Domain[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Domain | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<Domain | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newDomain, setNewDomain] = useState(EMPTY_NEW);
  const [addSaving, setAddSaving] = useState(false);

  const update = (patch: Partial<Domain>) => setEditing((cur) => cur ? { ...cur, ...patch } : cur);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const r = await fetch(`/api/signatures/domains/${editing.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(editing) });
    setSaving(false);
    if (!r.ok) { toast.error("Could not update domain."); return; }
    toast.success("Domain readiness updated");
    setEditing(null);
    router.refresh();
  };

  const addDomain = async () => {
    if (!newDomain.name.trim()) return;
    setAddSaving(true);
    const r = await fetch("/api/signatures/domains", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(newDomain) });
    setAddSaving(false);
    if (!r.ok) { const body = await r.json().catch(() => ({})); toast.error(body.error ?? "Could not add domain."); return; }
    toast.success(`${newDomain.name} added`);
    setAdding(false);
    setNewDomain(EMPTY_NEW);
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    const r = await fetch(`/api/signatures/domains/${toDelete.id}`, { method: "DELETE" });
    setDeleting(false);
    if (!r.ok) { toast.error("Could not remove domain."); return; }
    toast.success(`${toDelete.name} removed`);
    setToDelete(null);
    router.refresh();
  };

  return (
    <div className="space-y-5">
      <SetPageHeader title="Signature domains" description="Track the domains that deliver managed signatures." icon="solar:global-broken" actions={[{ label: "Overview", icon: "solar:arrow-left-broken", variant: "secondary", href: "/signatures" }, { label: "Add domain", icon: "solar:add-circle-broken", onClick: () => setAdding(true) }]} />

      <div className="grid gap-4 md:grid-cols-2">
        {domains.map((domain) => {
          const ready = domain.spf_verified && domain.dkim_verified;
          return (
            <article key={domain.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--text-hi)]">{domain.name}</p>
                  <p className="mt-1 text-sm capitalize text-[var(--text-lo)]">{domain.platform.replaceAll("_", " ")}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ready ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-700"}`}>
                  {ready ? "Verified" : "Needs review"}
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 text-sm">
                <span className={`rounded-xl px-3 py-2 ${domain.spf_verified ? "bg-emerald-500/10 text-emerald-700" : "bg-[var(--surface-2)] text-[var(--text-lo)]"}`}>SPF {domain.spf_verified ? "verified" : "pending"}</span>
                <span className={`rounded-xl px-3 py-2 ${domain.dkim_verified ? "bg-emerald-500/10 text-emerald-700" : "bg-[var(--surface-2)] text-[var(--text-lo)]"}`}>DKIM {domain.dkim_verified ? "verified" : "pending"}</span>
              </div>

              <div className="mt-5 flex items-center gap-2">
                <button type="button" onClick={() => setEditing(domain)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-3 py-2 text-sm font-semibold text-brand-500 hover:bg-brand-500 hover:text-white">
                  <Icon icon="solar:pen-broken" className="h-4 w-4" />Manage readiness
                </button>
                <button type="button" onClick={() => setToDelete(domain)} className="inline-flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-500 hover:bg-red-500 hover:text-white">
                  <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />Remove
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Edit modal */}
      <SimpleModal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Manage ${editing.name}` : "Manage domain"} icon="solar:global-broken">
        <div className="space-y-4">
          <label className="block text-sm font-medium">Email platform
            <select value={editing?.platform ?? "google_workspace"} onChange={(e) => update({ platform: e.target.value })} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
              <option value="google_workspace">Google Workspace</option>
              <option value="microsoft_365">Microsoft 365</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Gateway status
            <select value={editing?.gateway_status ?? "not_configured"} onChange={(e) => update({ gateway_status: e.target.value })} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
              <option value="not_configured">Not configured</option>
              <option value="pending_dns">Pending DNS</option>
              <option value="active">Active</option>
              <option value="error">Error</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-sm"><input type="checkbox" checked={editing?.spf_verified ?? false} onChange={(e) => update({ spf_verified: e.target.checked })} />SPF verified</label>
            <label className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] p-3 text-sm"><input type="checkbox" checked={editing?.dkim_verified ?? false} onChange={(e) => update({ dkim_verified: e.target.checked })} />DKIM verified</label>
          </div>
          <label className="block text-sm font-medium">Notes
            <textarea value={editing?.notes ?? ""} onChange={(e) => update({ notes: e.target.value })} className="mt-1.5 min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3" />
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </div>
      </SimpleModal>

      {/* Add domain modal */}
      <SimpleModal open={adding} onClose={() => { if (!addSaving) { setAdding(false); setNewDomain(EMPTY_NEW); } }} title="Add domain" icon="solar:global-broken" maxWidth="max-w-md">
        <div className="space-y-4">
          <label className="block text-sm font-medium">Domain name
            <input autoFocus value={newDomain.name} onChange={(e) => setNewDomain((d) => ({ ...d, name: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addDomain()} placeholder="example.com" className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm font-medium">Email platform
            <select value={newDomain.platform} onChange={(e) => setNewDomain((d) => ({ ...d, platform: e.target.value }))} className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
              <option value="google_workspace">Google Workspace</option>
              <option value="microsoft_365">Microsoft 365</option>
              <option value="other">Other</option>
            </select>
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" disabled={addSaving} onClick={() => { setAdding(false); setNewDomain(EMPTY_NEW); }}>Cancel</Button>
            <Button icon="solar:add-circle-broken" loading={addSaving} disabled={!newDomain.name.trim()} onClick={addDomain}>Add domain</Button>
          </div>
        </div>
      </SimpleModal>

      {/* Delete confirmation modal */}
      <SimpleModal open={!!toDelete} onClose={() => { if (!deleting) setToDelete(null); }} title="Remove domain" icon="solar:trash-bin-trash-broken" maxWidth="max-w-md">
        <p className="text-sm leading-6 text-[var(--text-lo)]">
          Remove <span className="font-semibold text-[var(--text-hi)]">{toDelete?.name}</span>? This will not affect existing synced signatures but the domain will no longer be tracked.
        </p>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" disabled={deleting} onClick={() => setToDelete(null)}>Cancel</Button>
          <Button variant="danger" icon="solar:trash-bin-trash-broken" loading={deleting} onClick={confirmDelete}>{deleting ? "Removing…" : "Remove domain"}</Button>
        </div>
      </SimpleModal>
    </div>
  );
}
