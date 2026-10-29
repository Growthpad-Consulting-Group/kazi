"use client";
/* eslint-disable @next/next/no-img-element -- attachments are dynamic R2 images. */

import { useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";

export type VoiceOutReport = {
  id: string;
  topic: string;
  message: string;
  status: "new" | "in_review" | "resolved" | "archived";
  priority: "low" | "normal" | "high" | "urgent";
  owner_id: string | null;
  internal_notes: string | null;
  allows_follow_up: boolean;
  attachments: string[];
  created_at: string;
};
const topicLabels: Record<string, string> = {
  workplace: "Workplace",
  wellbeing: "Wellbeing",
  inclusion: "Inclusion",
  leadership: "Leadership",
  other: "Other",
};

export function VoiceOutQueue({ reports }: { reports: VoiceOutReport[] }) {
  const [items, setItems] = useState(reports);
  const [saving, setSaving] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      reports.map((report) => [report.id, report.internal_notes ?? ""]),
    ),
  );
  const [replies, setReplies] = useState<Record<string, string>>({});

  async function update(id: string, changes: Record<string, string | boolean>) {
    setSaving(id);
    try {
      const response = await fetch("/api/pulse/voice-out", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...changes }),
      });
      if (!response.ok) throw new Error();
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? ({
                ...item,
                ...changes,
                owner_id: changes.take_ownership ? "assigned" : item.owner_id,
              } as VoiceOutReport)
            : item,
        ),
      );
    } finally {
      setSaving(null);
    }
  }

  if (!items.length)
    return (
      <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
          <Icon icon="solar:shield-check-broken" className="h-5 w-5" />
        </span>
        <h2 className="mt-3 text-sm font-semibold text-[var(--text-hi)]">
          Nothing needs review
        </h2>
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-lo)]">
          New anonymous reports will appear here for the HR team.
        </p>
      </div>
    );
  return (
    <div className="divide-y divide-[var(--border)]">
      {items.map((report) => (
        <article key={report.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[10px] font-semibold text-brand-500">
                  {topicLabels[report.topic]}
                </span>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${report.priority === "urgent" || report.priority === "high" ? "bg-red-500/10 text-red-600" : "bg-[var(--surface-2)] text-[var(--text-lo)]"}`}
                >
                  {report.priority}
                </span>
                {report.allows_follow_up && (
                  <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                    Follow-up enabled
                  </span>
                )}
                <span className="text-[10px] text-[var(--text-lo)]">
                  {new Date(report.created_at).toLocaleDateString("en-KE", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-hi)]">
                {report.message}
              </p>
              {report.attachments.length > 0 && (
                <div className="mt-3 flex gap-2">
                  {report.attachments.map((url) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="h-12 w-12 overflow-hidden rounded-lg border border-[var(--border)]"
                    >
                      <img
                        src={url}
                        alt="Report attachment"
                        className="h-full w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Report status"
                value={report.status}
                onChange={(event) =>
                  update(report.id, { status: event.target.value })
                }
                disabled={saving === report.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text-hi)] outline-none"
              >
                <option value="new">New</option>
                <option value="in_review">In review</option>
                <option value="resolved">Resolved</option>
                <option value="archived">Archived</option>
              </select>
              <Button
                size="sm"
                variant="secondary"
                loading={saving === report.id}
                onClick={() => update(report.id, { take_ownership: true })}
              >
                {report.owner_id ? "Owned" : "Take"}
              </Button>
            </div>
          </div>
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <label className="text-xs font-semibold text-[var(--text-hi)]">
              Internal case note
            </label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={notes[report.id] ?? ""}
                onChange={(event) =>
                  setNotes((current) => ({
                    ...current,
                    [report.id]: event.target.value,
                  }))
                }
                placeholder="Add context or a follow-up…"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--text-hi)] outline-none focus:border-brand-500/60"
              />
              <Button
                size="sm"
                variant="secondary"
                loading={saving === report.id}
                onClick={() =>
                  update(report.id, { internal_notes: notes[report.id] ?? "" })
                }
              >
                Save note
              </Button>
            </div>
            {report.allows_follow_up && (
              <div className="mt-3">
                <label className="text-xs font-semibold text-[var(--text-hi)]">
                  Anonymous reply
                </label>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={replies[report.id] ?? ""}
                    onChange={(event) =>
                      setReplies((current) => ({
                        ...current,
                        [report.id]: event.target.value,
                      }))
                    }
                    placeholder="Reply without identifying the reporter…"
                    className="min-w-0 flex-1 rounded-lg border border-blue-500/15 bg-blue-500/[0.04] px-3 py-2 text-xs text-[var(--text-hi)] outline-none focus:border-blue-500/60"
                  />
                  <Button
                    size="sm"
                    loading={saving === report.id}
                    disabled={!replies[report.id]?.trim()}
                    onClick={() => {
                      void update(report.id, { reply: replies[report.id] });
                      setReplies((current) => ({
                        ...current,
                        [report.id]: "",
                      }));
                    }}
                  >
                    Send reply
                  </Button>
                </div>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
