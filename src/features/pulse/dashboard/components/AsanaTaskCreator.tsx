"use client";

import { useState } from "react";

type Project = { gid: string; name: string };
type Source = {
  sourceType: "one_on_one_action" | "development_action";
  sourceId: string;
  actionIndex: number;
};

export default function AsanaTaskCreator({ source }: { source: Source }) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectGid, setProjectGid] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [status, setStatus] = useState<"idle" | "busy" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function openPanel() {
    setOpen(true);
    if (projects) return;
    const res = await fetch("/api/integrations/asana/projects");
    const body = (await res.json().catch(() => ({}))) as {
      projects?: Project[];
      error?: string;
    };
    if (!res.ok) {
      setStatus("error");
      setMessage(body.error ?? "Connect Asana to choose a project.");
      return;
    }
    setProjects(body.projects ?? []);
    if (body.projects?.[0]) setProjectGid(body.projects[0].gid);
  }

  async function create() {
    setStatus("busy");
    const res = await fetch("/api/integrations/asana/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...source,
        projectGid,
        dueOn: dueOn || null,
        confirmed: true,
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (res.ok) {
      setStatus("done");
      setMessage("Created in Asana.");
    } else {
      setStatus(res.status === 409 ? "done" : "error");
      setMessage(body.error ?? "Could not create the task.");
    }
  }

  if (status === "done")
    return <p className="mt-1 text-xs text-emerald-600">{message}</p>;

  if (!open)
    return (
      <button
        type="button"
        onClick={openPanel}
        className="mt-1 text-xs font-semibold text-brand-500 hover:text-brand-600"
      >
        Add to Asana
      </button>
    );

  return (
    <div className="mt-2 space-y-2 rounded-lg bg-[var(--surface-2)] p-3 text-xs">
      {projects ? (
        <>
          <label className="block text-[var(--text-hi)]">
            Project
            <select
              value={projectGid}
              onChange={(event) => setProjectGid(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
            >
              {projects.map((project) => (
                <option key={project.gid} value={project.gid}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[var(--text-hi)]">
            Due date (optional)
            <input
              type="date"
              value={dueOn}
              onChange={(event) => setDueOn(event.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs"
            />
          </label>
          <p className="text-[var(--text-lo)]">
            This creates an Asana task assigned to you. It contains the action
            text and a link back to Kazi, and nothing else from your records.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!projectGid || status === "busy"}
              onClick={create}
              className="rounded-md bg-brand-500 px-3 py-1.5 font-semibold text-white disabled:opacity-60"
            >
              {status === "busy" ? "Creating…" : "Create task"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 text-[var(--text-lo)]"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p className="text-[var(--text-lo)]">
          {message || "Loading projects…"}
        </p>
      )}
      {status === "error" && message && (
        <p className="text-red-500">{message}</p>
      )}
    </div>
  );
}
