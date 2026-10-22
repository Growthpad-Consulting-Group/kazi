"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";

type ItemType = "Campaign" | "Survey" | "Side Quest";

const ENDPOINT: Record<ItemType, (id: string) => string> = {
  Campaign: (id) => `/api/pulse/campaigns/${id}`,
  Survey: (id) => `/api/pulse/surveys/${id}`,
  "Side Quest": (id) => `/api/pulse/side-quests/${id}`,
};

const STATUS: Record<ItemType, string> = {
  Campaign: "archived",
  Survey: "closed",
  "Side Quest": "archived",
};

interface Props {
  id: string;
  type: ItemType;
}

export function ArchiveItemButton({ id, type }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const label = type === "Survey" ? "Close" : "Archive";

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault(); // prevent Link navigation
    e.stopPropagation();
    setLoading(true);
    try {
      await fetch(ENDPOINT[type](id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: STATUS[type] }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      title={label}
      aria-label={`${label} this ${type}`}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--text-lo)] transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-500/10"
    >
      {loading ? (
        <Icon icon="solar:refresh-broken" className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Icon icon="solar:archive-broken" className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
