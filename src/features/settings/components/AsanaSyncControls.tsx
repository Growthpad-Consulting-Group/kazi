"use client";

import { useState } from "react";

type Project = { gid: string; name: string };

function formatWhen(value: string | null) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AsanaSyncControls({
  lastSyncedAt,
  lastSyncError,
  selectedProjects,
  includeInSlackBrief,
}: {
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  selectedProjects: string[];
  includeInSlackBrief: boolean;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [chosen, setChosen] = useState<string[]>(selectedProjects);
  const [brief, setBrief] = useState(includeInSlackBrief);
  const [message, setMessage] = useState("");

  async function loadProjects() {
    setMessage("Loading projects…");
    const res = await fetch("/api/integrations/asana/projects");
    const body = (await res.json().catch(() => ({}))) as {
      projects?: Project[];
      error?: string;
    };
    if (!res.ok) return setMessage(body.error ?? "Could not load projects.");
    setProjects(body.projects ?? []);
    setMessage("");
  }

  async function save(patch: Record<string, unknown>) {
    const res = await fetch("/api/integrations/asana/sync-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setMessage(res.ok ? "Saved" : (body.error ?? "Could not save."));
    return res.ok;
  }

  function toggleProject(gid: string, on: boolean) {
    const next = on
      ? [...chosen, gid]
      : chosen.filter((value) => value !== gid);
    setChosen(next);
    void save({ selectedProjects: next });
  }

  async function toggleBrief(on: boolean) {
    const previous = brief;
    setBrief(on);
    if (!(await save({ includeInSlackBrief: on }))) setBrief(previous);
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5">
      <div className="text-xs text-[var(--text-lo)]">
        <p>
          Last synced:{" "}
          <span className="font-medium text-[var(--text-hi)]">
            {formatWhen(lastSyncedAt)}
          </span>
        </p>
        {lastSyncError && (
          <p className="mt-1 text-red-500">
            Last sync failed: {lastSyncError}. Reconnect Asana if this
            continues.
          </p>
        )}
      </div>

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--text-hi)]">
            Projects Kazi reads
          </span>
          {!projects && (
            <button
              type="button"
              onClick={loadProjects}
              className="text-xs font-semibold text-brand-500 hover:text-brand-600"
            >
              Choose projects
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--text-lo)]">
          {chosen.length
            ? `${chosen.length} selected`
            : "All your Asana work is read until you choose projects."}
        </p>
        {projects && (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
            {projects.map((project) => (
              <li key={project.gid}>
                <label className="flex items-center gap-2 text-xs text-[var(--text-hi)]">
                  <input
                    type="checkbox"
                    checked={chosen.includes(project.gid)}
                    onChange={(event) =>
                      toggleProject(project.gid, event.target.checked)
                    }
                    className="rounded"
                  />
                  {project.name}
                </label>
              </li>
            ))}
            {!projects.length && (
              <li className="text-xs text-[var(--text-lo)]">
                No projects found.
              </li>
            )}
          </ul>
        )}
      </div>

      <label className="flex cursor-pointer items-start gap-2 text-xs text-[var(--text-hi)]">
        <input
          type="checkbox"
          checked={brief}
          onChange={(event) => toggleBrief(event.target.checked)}
          className="mt-0.5 rounded"
        />
        <span>
          Include my due and overdue task counts in the Slack daily brief
        </span>
      </label>

      {message && <p className="text-xs text-[var(--text-lo)]">{message}</p>}
    </div>
  );
}
