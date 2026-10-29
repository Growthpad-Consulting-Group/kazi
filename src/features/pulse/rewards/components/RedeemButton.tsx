"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";

interface RedeemButtonProps {
  catalogueItemId: string;
  pointsCost: number;
  userBalance: number;
}

export default function RedeemButton({
  catalogueItemId,
  pointsCost,
  userBalance,
}: RedeemButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const disabled = userBalance < pointsCost;

  async function handleRedeem() {
    if (disabled) {
      const short = pointsCost - userBalance;
      toast.error(
        `You need ${short} more point${short === 1 ? "" : "s"} to redeem this.`,
      );
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/pulse/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ catalogue_item_id: catalogueItemId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Redemption failed.");
        return;
      }
      toast.success("Redemption submitted!");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="primary"
      loading={loading}
      className={disabled ? "opacity-50" : undefined}
      onClick={handleRedeem}
    >
      Redeem
    </Button>
  );
}
