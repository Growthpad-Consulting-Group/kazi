"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

/** Shown on a removed staff member's profile, with a way to bring them back. */
export function DeactivatedStaffBanner({
  staffId,
  name,
}: {
  staffId: string;
  name: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reactivate() {
    setBusy(true);
    try {
      const response = await fetch(`/api/staff/${staffId}/reactivate`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not reactivate.");
      toast.success(`${name} is active again`);
      router.refresh();
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Could not reactivate.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
      <p className="text-[var(--text-hi)]">
        {name} is deactivated, so they are hidden from the staff list and cannot
        sign in.
      </p>
      <Button
        size="sm"
        icon="solar:user-check-broken"
        loading={busy}
        onClick={reactivate}
      >
        Reactivate
      </Button>
    </div>
  );
}
