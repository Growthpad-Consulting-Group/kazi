"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

/** Returns the current user's resolved avatar URL, refreshed live from the server. */
export function useAvatar(): string | null {
  const { data: session } = useSession();
  const [url, setUrl] = useState<string | null>(session?.user?.image ?? null);

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/me/avatar")
      .then((r) => r.json())
      .then((d: { url: string | null }) => { if (d.url !== undefined) setUrl(d.url); })
      .catch(() => {});
  }, [session?.user?.id]);

  return url;
}
