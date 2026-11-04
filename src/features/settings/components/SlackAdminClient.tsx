"use client";

import { useState } from "react";
import type { CategorySummary } from "@/lib/slack-admin";

export default function SlackAdminClient({
  categories,
  enabled,
  summary,
}: {
  categories: string[];
  enabled: Record<string, boolean>;
  summary: CategorySummary[];
}) {
  const [state, setState] = useState<Record<string, boolean>>(enabled);
  const [message, setMessage] = useState("");

  async function setCategory(category: string, on: boolean) {
    const previous = state[category] ?? true;
    setState((current) => ({ ...current, [category]: on }));
    const res = await fetch("/api/settings/slack-controls", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, enabled: on }),
    });
    if (!res.ok) {
      setState((current) => ({ ...current, [category]: previous }));
      setMessage("Could not change that category.");
    } else setMessage("");
  }

  async function sendTest() {
    setMessage("Sending…");
    const res = await fetch("/api/settings/slack-test", { method: "POST" });
    const body = (await res.json().catch(() => ({}))) as {
      error?: string;
      outcome?: string;
    };
    if (!res.ok) setMessage(body.error ?? "Test failed.");
    else setMessage(`Test result: ${body.outcome ?? "sent"}.`);
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">
            Test delivery
          </h2>
          <button
            type="button"
            onClick={sendTest}
            className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
          >
            Send test to me
          </button>
        </div>
        {message && (
          <p className="mt-3 text-xs text-[var(--text-lo)]">{message}</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="text-xs text-[var(--text-lo)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">On</th>
              <th className="px-4 py-3 font-semibold">Delivered (30 d)</th>
              <th className="px-4 py-3 font-semibold">Held back</th>
              <th className="px-4 py-3 font-semibold">Failed</th>
              <th className="px-4 py-3 font-semibold">Most common reason</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((category) => {
              const row = summary.find((item) => item.category === category);
              return (
                <tr key={category} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--text-hi)]">
                    {category}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Send ${category}`}
                      checked={state[category] ?? true}
                      onChange={(event) =>
                        setCategory(category, event.target.checked)
                      }
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono">{row?.delivered ?? 0}</td>
                  <td className="px-4 py-3 font-mono">
                    {row?.suppressed ?? 0}
                  </td>
                  <td className="px-4 py-3 font-mono">{row?.failed ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-[var(--text-lo)]">
                    {row?.reasons[0]?.reason ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
