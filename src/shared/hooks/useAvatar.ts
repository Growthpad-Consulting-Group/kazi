"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

// The sidebar and the header both use this hook, and it runs on every page change. One shared
// request per minute is enough, so the photo isn't fetched again each time.
const TTL_MS = 60_000;
let cached: { userId: string; url: string | null; at: number } | null = null;
let pending: { userId: string; promise: Promise<string | null> } | null = null;

function loadAvatar(userId: string): Promise<string | null> {
  if (cached && cached.userId === userId && Date.now() - cached.at < TTL_MS) return Promise.resolve(cached.url);
  if (pending && pending.userId === userId) return pending.promise;
  const promise = fetch("/api/me/avatar")
    .then((r) => r.json())
    .then((d: { url: string | null }) => {
      cached = { userId, url: d.url ?? null, at: Date.now() };
      return cached.url;
    })
    .finally(() => {
      pending = null;
    });
  pending = { userId, promise };
  return promise;
}

/** Returns the current user's resolved avatar URL, refreshed live from the server. */
export function useAvatar(): string | null {
  const { data: session } = useSession();
  const [url, setUrl] = useState<string | null>(session?.user?.image ?? null);

  useEffect(() => {
    if (!session?.user?.id) return;
    let active = true;
    loadAvatar(session.user.id)
      .then((value) => { if (active && value !== undefined) setUrl(value); })
      .catch(() => {});
    return () => { active = false; };
  }, [session?.user?.id]);

  return url;
}
