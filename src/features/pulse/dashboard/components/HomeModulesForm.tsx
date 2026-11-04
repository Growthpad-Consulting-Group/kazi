"use client";

import { useState } from "react";
import { HOME_MODULES, type HomeModuleId } from "../home-modules";

export default function HomeModulesForm({
  initial,
}: {
  initial: HomeModuleId[];
}) {
  const [selected, setSelected] = useState<HomeModuleId[]>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  function toggle(id: HomeModuleId, on: boolean) {
    setSelected((current) =>
      on ? [...current, id] : current.filter((value) => value !== id),
    );
    setStatus("idle");
  }

  async function save() {
    setStatus("saving");
    try {
      const response = await fetch("/api/pulse/home-modules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: selected }),
      });
      setStatus(response.ok ? "saved" : "error");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="max-w-2xl space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <p className="rounded-xl bg-[var(--surface-2)] p-3 text-xs text-[var(--text-lo)]">
        Your next-step queue always appears first and cannot be hidden. The
        cards below are optional extras.
      </p>
      <div className="divide-y divide-[var(--border)]">
        {HOME_MODULES.map((module) => (
          <label
            key={module.id}
            className="flex cursor-pointer items-start gap-3 py-3"
          >
            <input
              type="checkbox"
              className="mt-0.5 rounded"
              checked={selected.includes(module.id)}
              onChange={(event) => toggle(module.id, event.target.checked)}
            />
            <span>
              <span className="block text-sm font-semibold text-[var(--text-hi)]">
                {module.label}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--text-lo)]">
                {module.description}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={status === "saving"}
          className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : "Save"}
        </button>
        {status === "saved" && (
          <span className="text-xs text-emerald-600">Saved</span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-500">
            Could not save. Try again.
          </span>
        )}
      </div>
    </section>
  );
}
