"use client";

import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

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
  const [draftChosen, setDraftChosen] = useState<string[]>(selectedProjects);
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsSaving, setProjectsSaving] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [brief, setBrief] = useState(includeInSlackBrief);
  const [message, setMessage] = useState("");

  const visibleProjects = useMemo(() => {
    const term = projectSearch.trim().toLowerCase();
    if (!term) return projects ?? [];
    return (projects ?? []).filter((project) =>
      project.name.toLowerCase().includes(term),
    );
  }, [projectSearch, projects]);

  async function openProjectPicker() {
    setProjectPickerOpen(true);
    setProjectSearch("");
    setDraftChosen(chosen);
    if (projects) return;
    setProjectsLoading(true);
    try {
      const res = await fetch("/api/integrations/asana/projects");
      const body = (await res.json().catch(() => ({}))) as {
        projects?: Project[];
        error?: string;
      };
      if (!res.ok) {
        setMessage(body.error ?? "Could not load projects.");
        return;
      }
      setProjects(body.projects ?? []);
    } catch {
      setMessage(
        "Could not load projects. Check your connection and try again.",
      );
    } finally {
      setProjectsLoading(false);
    }
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

  function toggleDraftProject(gid: string, on: boolean) {
    const next = on
      ? [...draftChosen, gid]
      : draftChosen.filter((value) => value !== gid);
    setDraftChosen(next);
  }

  async function saveProjects() {
    const previous = chosen;
    setChosen(draftChosen);
    setProjectsSaving(true);
    const saved = await save({ selectedProjects: draftChosen });
    setProjectsSaving(false);
    if (saved) {
      setProjectPickerOpen(false);
      return;
    }
    setChosen(previous);
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
          <Button
            size="sm"
            variant="secondary"
            icon="solar:folder-with-files-broken"
            onClick={openProjectPicker}
          >
            Choose projects
          </Button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-lo)]">
          {chosen.length
            ? `${chosen.length} selected`
            : "All Asana projects you can access are included until you choose projects."}
        </p>
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

      <SimpleModal
        open={projectPickerOpen}
        onClose={() => !projectsSaving && setProjectPickerOpen(false)}
        title="Choose Asana projects"
        subtitle="Limit Kazi to the projects that matter to your work."
        icon="logos:asana-icon"
        maxWidth="max-w-xl"
        bodyClassName="max-h-[calc(70vh-65px)] overflow-y-auto px-5 py-4"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-500/15 bg-brand-500/5 p-3">
            <div className="flex items-start gap-2">
              <Icon
                icon="solar:shield-check-broken"
                className="mt-0.5 h-4 w-4 shrink-0 text-brand-500"
              />
              <p className="text-xs leading-5 text-[var(--text-lo)]">
                Choose one or more projects to narrow the work Kazi reads.
                Leaving this list empty means Kazi can read all of your Asana
                work.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-semibold text-[var(--text-hi)]">
              {draftChosen.length
                ? `${draftChosen.length} selected`
                : "All projects"}
            </span>
            <button
              type="button"
              className="text-xs font-semibold text-brand-500 hover:text-brand-600"
              onClick={() => setDraftChosen([])}
            >
              Read all projects
            </button>
          </div>

          <label className="relative block">
            <Icon
              icon="solar:magnifer-broken"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-lo)]"
            />
            <input
              value={projectSearch}
              onChange={(event) => setProjectSearch(event.target.value)}
              placeholder="Search projects"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-9 pr-3 text-sm text-[var(--text-hi)] outline-none transition-colors placeholder:text-[var(--text-lo)] focus:border-brand-500"
            />
          </label>

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {projectsLoading && (
              <div className="flex items-center gap-2 px-3 py-8 text-sm text-[var(--text-lo)]">
                <Icon
                  icon="solar:spinner-broken"
                  className="h-4 w-4 animate-spin"
                />
                Loading projects…
              </div>
            )}
            {!projectsLoading &&
              visibleProjects.map((project) => {
                const selected = draftChosen.includes(project.gid);
                return (
                  <label
                    key={project.gid}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-brand-500/5"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={(event) =>
                        toggleDraftProject(project.gid, event.target.checked)
                      }
                      className="h-4 w-4 rounded border-[var(--border)] accent-[var(--brand)]"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--text-hi)]">
                      {project.name}
                    </span>
                    {selected && (
                      <Icon
                        icon="solar:check-circle-broken"
                        className="h-4 w-4 shrink-0 text-brand-500"
                      />
                    )}
                  </label>
                );
              })}
            {!projectsLoading && !visibleProjects.length && (
              <p className="px-3 py-8 text-center text-sm text-[var(--text-lo)]">
                {projects?.length
                  ? "No matching projects."
                  : "No Asana projects found."}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              variant="ghost"
              onClick={() => setProjectPickerOpen(false)}
              disabled={projectsSaving}
            >
              Cancel
            </Button>
            <Button
              icon="solar:check-circle-broken"
              onClick={saveProjects}
              loading={projectsSaving}
              disabled={projectsLoading}
            >
              Save project access
            </Button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
