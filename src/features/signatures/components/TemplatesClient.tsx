"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { SimpleModal } from "@/components/ui/SimpleModal";
import StatCard from "@/components/ui/StatCard";
import { Button } from "@/components/ui/Button";

type Template = {
  id: string;
  name: string;
  description: string | null;
  html: string;
  thumbnail_url: string | null;
  is_default: boolean;
  updated_at: string;
  link_clicks: number;
  assignment_count: number;
};
type TemplateFilter = "all" | "default" | "assigned" | "unassigned";

function formatUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  return `Updated ${date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}`;
}

export default function TemplatesClient({
  templates,
}: {
  templates: Template[];
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<Template | null>(null);
  const [deleting, setDeleting] = useState<Template | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TemplateFilter>("all");
  function edit(template: Template) {
    router.push("/signatures/templates/" + template.id + "/edit");
  }
  async function remove() {
    if (!deleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch("/api/signatures/templates/" + deleting.id, {
        method: "DELETE",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error ?? "Could not delete template.");
      toast.success("Template deleted");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not delete template.",
      );
    } finally {
      setIsDeleting(false);
    }
  }
  const totals = useMemo(
    () => ({
      assigned: templates.reduce(
        (sum, template) => sum + template.assignment_count,
        0,
      ),
      clicks: templates.reduce(
        (sum, template) => sum + template.link_clicks,
        0,
      ),
      defaults: templates.filter((template) => template.is_default).length,
    }),
    [templates],
  );
  const filteredTemplates = useMemo(
    () =>
      templates.filter((template) => {
        const searchable =
          `${template.name} ${template.description ?? ""}`.toLowerCase();
        if (query.trim() && !searchable.includes(query.trim().toLowerCase()))
          return false;
        if (filter === "default") return template.is_default;
        if (filter === "assigned") return template.assignment_count > 0;
        if (filter === "unassigned") return template.assignment_count === 0;
        return true;
      }),
    [filter, query, templates],
  );

  return (
    <div className="space-y-5">
      <SetPageHeader
        title="Signature templates"
        description="Build the signature designs your staff use every day."
        icon="solar:document-text-broken"
        actions={[
          {
            label: "Signature staff",
            icon: "solar:users-group-rounded-broken",
            variant: "secondary",
            href: "/signatures/staff",
          },
          {
            label: "New template",
            icon: "solar:add-circle-broken",
            variant: "primary",
            href: "/signatures/templates/new",
          },
        ]}
      />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Templates"
          value={templates.length}
          icon="solar:document-text-broken"
          color="orange"
          variant="inline"
          compact
          onClick={() => setFilter("all")}
        />
        <StatCard
          title="Default design"
          value={totals.defaults}
          icon="solar:star-broken"
          color="amber"
          variant="inline"
          compact
          onClick={() => setFilter("default")}
        />
        <StatCard
          title="Staff assigned"
          value={totals.assigned}
          icon="solar:users-group-rounded-broken"
          color="blue"
          variant="inline"
          compact
          onClick={() => setFilter("assigned")}
        />
        <StatCard
          title="Tracked clicks"
          value={totals.clicks.toLocaleString()}
          icon="solar:cursor-square-broken"
          color="green"
          variant="inline"
          compact
        />
      </section>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="font-semibold text-[var(--text-hi)]">
              Template library
            </h2>
            <p className="mt-1 text-sm text-[var(--text-lo)]">
              Preview a design, open its builder, or see which staff use it.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
            <label className="relative min-w-0 sm:w-64">
              <Icon
                icon="solar:magnifer-broken"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-lo)]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates"
                className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] pl-9 pr-3 text-sm text-[var(--text-hi)] outline-none transition-colors placeholder:text-[var(--text-lo)] focus:border-brand-500"
              />
            </label>
            <label className="relative">
              <span className="sr-only">Filter templates</span>
              <select
                value={filter}
                onChange={(event) =>
                  setFilter(event.target.value as TemplateFilter)
                }
                className="h-9 w-full appearance-none rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 pr-9 text-sm font-medium text-[var(--text-hi)] outline-none focus:border-brand-500 sm:w-40"
              >
                <option value="all">All templates</option>
                <option value="default">Default</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
              <Icon
                icon="solar:alt-arrow-down-broken"
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-lo)]"
              />
            </label>
          </div>
        </div>
        {filteredTemplates.length ? (
          <div className="grid gap-4 p-5 md:grid-cols-2 2xl:grid-cols-3">
            {filteredTemplates.map((template) => (
              <article
                key={template.id}
                className="group overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-2xl dark:shadow-black/20"
              >
                <div className="relative flex h-48 items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-brand-500/10 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-brand-500/10">
                  <div className="h-full w-full overflow-hidden rounded-xl bg-white shadow-md">
                    <iframe
                      title={template.name + " preview"}
                      sandbox=""
                      srcDoc={template.html}
                      className="h-[430px] w-[800px] origin-top-left scale-[0.39] border-0"
                    />
                  </div>
                  <div className="absolute left-6 top-6 flex items-center gap-2">
                    {template.is_default && (
                      <span className="rounded-full bg-brand-500 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white shadow-sm">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreview(template)}
                    className="absolute right-6 top-6 flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 text-slate-700 shadow-sm transition-colors hover:bg-brand-500 hover:text-white dark:bg-slate-800/90 dark:text-slate-100"
                    aria-label={`Preview ${template.name}`}
                  >
                    <Icon icon="solar:eye-broken" className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[var(--text-hi)]">
                        {template.name}
                      </h3>
                      <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-[var(--text-lo)]">
                        {template.description ??
                          "Growthpad email signature template"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 divide-x divide-[var(--border)] rounded-xl bg-[var(--surface-2)] py-2.5">
                    <div className="px-3">
                      <p className="text-sm font-semibold text-[var(--text-hi)]">
                        {template.assignment_count}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-lo)]">
                        staff assigned
                      </p>
                    </div>
                    <Link
                      href={`/signatures/templates/${template.id}/clicks`}
                      className="px-3 transition-colors hover:text-brand-500"
                    >
                      <p className="flex items-center gap-1 text-sm font-semibold text-[var(--text-hi)]">
                        <Icon
                          icon="solar:cursor-square-broken"
                          className="h-3.5 w-3.5 text-sky-500"
                        />
                        {template.link_clicks.toLocaleString()}
                      </p>
                      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--text-lo)]">
                        tracked clicks
                      </p>
                    </Link>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-[var(--text-lo)]">
                      {formatUpdatedAt(template.updated_at)}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="solar:eye-broken"
                        onClick={() => setPreview(template)}
                      >
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="solar:pen-broken"
                        onClick={() => edit(template)}
                      >
                        Edit
                      </Button>
                      <button
                        type="button"
                        disabled={template.is_default}
                        onClick={() => setDeleting(template)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-35"
                        title={
                          template.is_default
                            ? "Choose another default template before deleting this one."
                            : "Delete template"
                        }
                        aria-label={`Delete ${template.name}`}
                      >
                        <Icon
                          icon="solar:trash-bin-trash-broken"
                          className="h-4 w-4"
                        />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="px-6 py-16 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
              <Icon
                icon={
                  templates.length
                    ? "solar:magnifer-broken"
                    : "solar:document-add-broken"
                }
                className="h-6 w-6"
              />
            </span>
            <h3 className="mt-4 font-semibold text-[var(--text-hi)]">
              {templates.length
                ? "No templates match this view"
                : "Start your signature library"}
            </h3>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-[var(--text-lo)]">
              {templates.length
                ? "Try another search or clear the current filter."
                : "Create a reusable signature design, then assign it to the staff who need it."}
            </p>
            {templates.length ? (
              <Button
                className="mt-5"
                size="sm"
                variant="secondary"
                icon="solar:restart-broken"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button
                className="mt-5"
                size="sm"
                icon="solar:add-circle-broken"
                href="/signatures/templates/new"
              >
                New template
              </Button>
            )}
          </div>
        )}
      </section>
      <SimpleModal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={preview?.name ?? "Template preview"}
        icon="solar:document-text-broken"
        maxWidth="max-w-4xl"
      >
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <iframe
            title="Email signature preview"
            sandbox=""
            srcDoc={preview?.html ?? ""}
            className="h-[540px] w-full border-0"
          />
        </div>
      </SimpleModal>
      <SimpleModal
        open={!!deleting}
        onClose={() => {
          if (!isDeleting) setDeleting(null);
        }}
        title="Delete signature template"
        icon="solar:trash-bin-trash-broken"
        maxWidth="max-w-md"
      >
        <p className="text-sm leading-6 text-[var(--text-lo)]">
          Delete{" "}
          <span className="font-semibold text-[var(--text-hi)]">
            {deleting?.name}
          </span>
          ? This removes its version history and cannot be undone. Templates
          assigned to staff must be reassigned first.
        </p>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => setDeleting(null)}
            className="rounded-xl px-3.5 py-2 text-sm font-semibold text-[var(--text-lo)] hover:bg-[var(--surface-2)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={remove}
            className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <Icon icon="solar:trash-bin-trash-broken" className="h-4 w-4" />
            {isDeleting ? "Deleting…" : "Delete template"}
          </button>
        </div>
      </SimpleModal>
    </div>
  );
}
