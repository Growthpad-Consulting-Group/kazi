"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

/** Lets an employee correct the role title shown in their own signature. */
export function RoleTitleEditor({
  initial,
  phone: initialPhone,
}: {
  initial: string | null;
  phone: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/signatures/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_title: value, phone }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        gmail?: string;
        gmailError?: string;
      } | null;
      if (!res.ok)
        throw new Error(data?.error ?? "Could not save your role title.");
      if (data?.gmail === "error")
        toast.error(
          `Saved, but your email signature did not update: ${data.gmailError ?? "Gmail sync failed."}`,
        );
      else toast.success("Signature details updated");
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save your role title.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="mt-1 flex items-center gap-2">
        <div className="text-sm text-[var(--text-lo)]">
          <p>{initial ?? "No role title set"}</p>
          <p>{initialPhone ?? "No phone number set"}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-semibold text-brand-500 hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={120}
        aria-label="Role title"
        placeholder="e.g. Full Stack Developer"
        className="w-full max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] outline-none focus:ring-2 focus:ring-brand-500/40"
      />
      <input
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        maxLength={40}
        aria-label="Phone number"
        placeholder="Phone number"
        className="w-full max-w-xs rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] outline-none focus:ring-2 focus:ring-brand-500/40"
      />
      <Button size="sm" loading={saving} onClick={save}>
        Save
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setValue(initial ?? "");
          setPhone(initialPhone ?? "");
          setEditing(false);
        }}
      >
        Cancel
      </Button>
    </div>
  );
}
