"use client";

import { useEffect, useRef, useState } from "react";

const TIMER_STORAGE_KEY = "kazi:daily-log:active-timer";
const TIMER_EVENT = "kazi:daily-log:timer-change";

type StoredTimer = {
  startedAt: number;
  accumulatedSeconds: number;
  row?: { task?: string };
};

function readActiveTimer(): StoredTimer | null {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(TIMER_STORAGE_KEY) ?? "null",
    ) as Partial<StoredTimer> | null;
    if (
      !value ||
      typeof value.startedAt !== "number" ||
      typeof value.accumulatedSeconds !== "number"
    )
      return null;
    return {
      startedAt: value.startedAt,
      accumulatedSeconds: value.accumulatedSeconds,
      row: value.row,
    };
  } catch {
    return null;
  }
}

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function ActiveTimerTabIndicator() {
  const [timer, setTimer] = useState<StoredTimer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const originalTitle = useRef<string | null>(null);
  const faviconLink = useRef<HTMLLinkElement | null>(null);
  const faviconImage = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const sync = () => setTimer(readActiveTimer());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(TIMER_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(TIMER_EVENT, sync);
    };
  }, []);

  useEffect(() => {
    if (!timer) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!timer) {
      if (originalTitle.current) document.title = originalTitle.current;
      originalTitle.current = null;
      faviconLink.current?.remove();
      faviconLink.current = null;
      return;
    }

    if (!originalTitle.current) originalTitle.current = document.title;
    const elapsed = timer.accumulatedSeconds * 1000 + now - timer.startedAt;
    const task = timer.row?.task?.trim().replace(/\s+/g, " ");
    const taskLabel = task ? ` · ${task.slice(0, 48)}` : "";
    document.title = `${formatElapsed(elapsed)}${taskLabel} · ${originalTitle.current}`;

    if (!faviconLink.current) {
      const link = document.createElement("link");
      link.rel = "icon";
      link.type = "image/png";
      link.dataset.kaziTimerBadge = "true";
      document.head.appendChild(link);
      faviconLink.current = link;
    }

    const paintBadge = (image: HTMLImageElement | null) => {
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const context = canvas.getContext("2d");
      if (!context) return;
      if (image) context.drawImage(image, 0, 0, 64, 64);
      else {
        context.fillStyle = "#f05d23";
        context.fillRect(0, 0, 64, 64);
      }
      context.fillStyle = "#f05d23";
      context.beginPath();
      context.arc(50, 50, 15, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#fff";
      context.font = "bold 18px system-ui";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText("▶", 51, 50);
      faviconLink.current!.href = canvas.toDataURL("image/png");
    };

    if (faviconImage.current) {
      paintBadge(faviconImage.current);
      return;
    }
    const image = new Image();
    image.src = "/favicon.png";
    image.onload = () => {
      faviconImage.current = image;
      paintBadge(image);
    };
    image.onerror = () => paintBadge(null);
  }, [now, timer]);

  return null;
}

export const activeTimerTabEvent = TIMER_EVENT;
