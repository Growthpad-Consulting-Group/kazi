"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

interface RedemptionActionsProps {
  redemptionId: string;
  status: "pending" | "approved";
}

export default function RedemptionActions({
  redemptionId,
  status,
}: RedemptionActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<
    "approved" | "fulfilled" | "rejected" | null
  >(null);

  async function handleAction(
    nextStatus: "approved" | "fulfilled" | "rejected",
  ) {
    setLoading(nextStatus);
    try {
      const res = await fetch(
        `/api/pulse/rewards/redemptions/${redemptionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Action failed.");
        return;
      }
      toast.success(
        nextStatus === "approved"
          ? "Redemption approved."
          : nextStatus === "fulfilled"
            ? "Reward marked fulfilled."
            : "Redemption rejected and points refunded.",
      );
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex gap-2">
      {status === "pending" ? (
        <Button
          size="sm"
          variant="primary"
          loading={loading === "approved"}
          disabled={loading !== null}
          onClick={() => handleAction("approved")}
        >
          Approve
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          loading={loading === "fulfilled"}
          disabled={loading !== null}
          onClick={() => handleAction("fulfilled")}
        >
          Fulfil
        </Button>
      )}
      <Button
        size="sm"
        variant="danger"
        loading={loading === "rejected"}
        disabled={loading !== null}
        onClick={() => handleAction("rejected")}
      >
        Reject
      </Button>
    </div>
  );
}
