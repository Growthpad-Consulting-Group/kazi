"use client";

import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { compressImageFile } from "@/lib/compressImageFile";

interface Props {
  value: string;
  /** A read-only image used when the staff profile inherits its photo from another Kazi module. */
  previewUrl?: string;
  name: string;
  /** POST endpoint that accepts multipart/form-data with a "file" field and returns { url: string } */
  uploadEndpoint: string;
  onChange: (url: string) => void;
  size?: "sm" | "md" | "lg";
}

const sizes = {
  sm: { wrap: "h-12 w-12", text: "text-sm", icon: "h-3.5 w-3.5" },
  md: { wrap: "h-16 w-16", text: "text-base", icon: "h-4 w-4" },
  lg: { wrap: "h-20 w-20", text: "text-lg", icon: "h-4 w-4" },
};

export default function AvatarUpload({
  value,
  previewUrl,
  name,
  uploadEndpoint,
  onChange,
  size = "md",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const dim = sizes[size];

  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Image must be under 25 MB.");
      return;
    }

    setUploading(true);
    const id = toast.loading("Uploading photo…");
    try {
      const compressed = await compressImageFile(file, {
        maxDimension: 512,
        quality: 0.85,
      });
      const form = new FormData();
      form.append("file", compressed);
      const res = await fetch(uploadEndpoint, { method: "POST", body: form });
      const body = (await res.json()) as { url?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Upload failed.");
      onChange(body.url!);
      toast.success("Photo updated", { id });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.", {
        id,
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      {/* Avatar circle */}
      <div
        className={`relative shrink-0 ${dim.wrap} overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500/20 to-violet-500/10`}
      >
        {value || previewUrl ? (
          <img
            src={value || previewUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            className={`flex h-full w-full items-center justify-center font-bold text-brand-500 ${dim.text}`}
          >
            {initials}
          </span>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
            <Icon
              icon="solar:refresh-broken"
              className="h-5 w-5 text-white animate-spin"
            />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold text-[var(--text-hi)] transition-all hover:border-brand-500/40 hover:text-brand-500 disabled:opacity-50 active:scale-95"
        >
          <Icon icon="solar:upload-broken" className={dim.icon} />
          {uploading ? "Uploading…" : "Upload photo"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-[var(--text-lo)] transition-all hover:text-red-500 disabled:opacity-50"
          >
            <Icon icon="solar:trash-bin-trash-broken" className={dim.icon} />
            Remove
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
