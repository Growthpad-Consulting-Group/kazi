"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

interface Props {
  userId: string;
  userName: string;
}

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export default function GrantPointsModal({ userId, userName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setPoints("");
    setReason("");
  }

  function grant() {
    const pts = Number(points);
    if (!Number.isInteger(pts) || pts < 1 || pts > 9999) {
      toast.error("Points must be a whole number between 1 and 9999.");
      return;
    }
    if (!reason.trim()) {
      toast.error("Please enter a reason for the grant.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/pulse/rewards/grant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            points: pts,
            reason: reason.trim(),
          }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Failed to grant points");
        toast.success(
          `${pts} point${pts === 1 ? "" : "s"} granted to ${userName}`,
        );
        setOpen(false);
        reset();
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not grant points");
      }
    });
  }

  return (
    <>
      <Button
        size="sm"
        icon="solar:star-broken"
        variant="secondary"
        onClick={() => setOpen(true)}
      >
        Grant Points
      </Button>

      <SimpleModal
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        title="Grant Reward Points"
        icon="solar:star-broken"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-lo)]">
            Manually award reward points to{" "}
            <span className="font-semibold text-[var(--text-hi)]">
              {userName}
            </span>
            .
          </p>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Points
            </span>
            <input
              type="number"
              min={1}
              max={9999}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="e.g. 50"
              className={inputCls}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Reason
            </span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Exceptional project delivery"
              className={inputCls}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              reset();
            }}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]"
          >
            Cancel
          </button>
          <Button icon="solar:star-broken" loading={isPending} onClick={grant}>
            {isPending ? "Granting…" : "Grant Points"}
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
