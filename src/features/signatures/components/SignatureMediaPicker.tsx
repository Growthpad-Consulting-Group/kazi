"use client";
/* eslint-disable react-hooks/set-state-in-effect, @next/next/no-img-element -- loading the modal inventory is intentionally effect-driven; media URLs may be external. */

import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { SimpleModal } from "@/components/ui/SimpleModal";

type MediaAsset = { id: string; public_url: string; filename: string | null; created_at: string };

export default function SignatureMediaPicker({ isOpen, onClose, onSelect }: { isOpen: boolean; onClose: () => void; onSelect: (url: string) => void }) {
  const [url, setUrl] = useState("");
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/signatures/media");
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not load the media library.");
      setAssets(body.assets ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the media library.");
    } finally { setLoading(false); }
  };

  useEffect(() => { if (isOpen) void loadAssets(); }, [isOpen]);

  const upload = async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Choose an image file."); return; }
    setUploading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const response = await fetch("/api/signatures/media", { method: "POST", body: form });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Could not upload image.");
      toast.success("Image added to the library");
      await loadAssets();
      if (body.asset?.public_url) onSelect(body.asset.public_url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload image.");
    } finally { setUploading(false); }
  };

  return <SimpleModal open={isOpen} onClose={onClose} title="Choose image" icon="solar:gallery-broken" maxWidth="max-w-3xl">
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] p-3">
        <div><p className="text-sm font-semibold text-[var(--text-hi)]">Signature media library</p><p className="text-xs text-[var(--text-lo)]">Upload once, then reuse assets across templates.</p></div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.currentTarget.value = ""; }} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-[#f05d23] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Icon icon="solar:upload-minimalistic-broken" className="h-4 w-4" />{uploading ? "Uploading…" : "Upload image"}</button>
      </div>
      {loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="aspect-square animate-pulse rounded-xl bg-[var(--surface-2)]" />)}</div> : assets.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{assets.map((asset) => <button key={asset.id} type="button" onClick={() => onSelect(asset.public_url)} className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] text-left transition hover:border-[#f05d23]/60 hover:shadow-md"><div className="aspect-square bg-[var(--surface-2)] p-2"><img src={asset.public_url} alt="" className="h-full w-full object-contain" /></div><span className="block truncate border-t border-[var(--border)] px-2 py-1.5 text-xs text-[var(--text-lo)]">{asset.filename ?? "Image"}</span></button>)}</div> : <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center text-sm text-[var(--text-lo)]">No saved images yet. Upload a logo, team photo, or campaign graphic.</div>}
      <div className="border-t border-[var(--border)] pt-4"><label className="text-xs font-semibold uppercase tracking-wide text-[var(--text-lo)]">Use an external image URL</label><div className="mt-2 flex gap-2"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm" /><button type="button" disabled={!url.trim()} onClick={() => { onSelect(url.trim()); setUrl(""); }} className="rounded-xl bg-[var(--surface-2)] px-3 py-2 text-sm font-semibold text-[var(--text-hi)] disabled:opacity-50">Use URL</button></div></div>
      <div className="flex justify-end"><button type="button" onClick={onClose} className="rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-lo)]">Cancel</button></div>
    </div>
  </SimpleModal>;
}
