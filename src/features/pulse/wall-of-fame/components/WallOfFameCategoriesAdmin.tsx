"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import SetPageHeader from "@/components/ui/SetPageHeader";
import {
  parseCriteria,
  type WallOfFameCategory,
} from "@/lib/wall-of-fame-category-rules";

type Draft = {
  label: string;
  description: string;
  purpose: string;
  criteriaText: string;
  icon: string;
  sort_order: number;
  active: boolean;
};

const EMPTY_DRAFT: Draft = {
  label: "",
  description: "",
  purpose: "",
  criteriaText: "",
  icon: "solar:medal-ribbon-broken",
  sort_order: 100,
  active: true,
};

function draftFrom(category: WallOfFameCategory): Draft {
  return {
    label: category.label,
    description: category.description,
    purpose: category.purpose,
    criteriaText: category.criteria.join("\n"),
    icon: category.icon,
    sort_order: category.sort_order,
    active: category.active,
  };
}

function payload(draft: Draft) {
  return {
    label: draft.label,
    description: draft.description,
    purpose: draft.purpose,
    criteria: parseCriteria(draft.criteriaText),
    icon: draft.icon,
    sort_order: Number(draft.sort_order),
    active: draft.active,
  };
}

const INPUT =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500";

function Fields({
  draft,
  onChange,
  keyEditable,
  keyValue,
  onKeyChange,
}: {
  draft: Draft;
  onChange: (next: Draft) => void;
  keyEditable: boolean;
  keyValue?: string;
  onKeyChange?: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {keyEditable && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-lo)]">
          Key (cannot change later)
          <input
            className={INPUT}
            value={keyValue ?? ""}
            onChange={(event) => onKeyChange?.(event.target.value)}
            placeholder="client_win"
          />
        </label>
      )}
      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-lo)]">
        Name shown to staff
        <input
          className={INPUT}
          value={draft.label}
          onChange={(event) =>
            onChange({ ...draft, label: event.target.value })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-lo)] sm:col-span-2">
        Short description
        <input
          className={INPUT}
          value={draft.description}
          onChange={(event) =>
            onChange({ ...draft, description: event.target.value })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-lo)] sm:col-span-2">
        Purpose
        <textarea
          rows={2}
          className={INPUT}
          value={draft.purpose}
          onChange={(event) =>
            onChange({ ...draft, purpose: event.target.value })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-lo)] sm:col-span-2">
        Criteria (one per line, up to 6)
        <textarea
          rows={3}
          className={INPUT}
          value={draft.criteriaText}
          onChange={(event) =>
            onChange({ ...draft, criteriaText: event.target.value })
          }
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-lo)]">
        Icon (Iconify name)
        <input
          className={INPUT}
          value={draft.icon}
          onChange={(event) => onChange({ ...draft, icon: event.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--text-lo)]">
        Display order
        <input
          type="number"
          min={0}
          max={999}
          className={INPUT}
          value={draft.sort_order}
          onChange={(event) =>
            onChange({ ...draft, sort_order: Number(event.target.value) })
          }
        />
      </label>
    </div>
  );
}

function CategoryCard({ category }: { category: WallOfFameCategory }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(category));
  const [saving, setSaving] = useState(false);

  const save = async (next: Draft) => {
    setSaving(true);
    const response = await fetch("/api/pulse/wall-of-fame/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: category.key, ...payload(next) }),
    });
    setSaving(false);
    const json = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok)
      return toast.error(json?.error ?? "Could not save the category.");
    toast.success(
      next.active
        ? "Category saved."
        : "Category retired. It stays on past cycles.",
    );
    router.refresh();
  };

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-hi)]">
            {category.label}
          </h2>
          <p className="font-mono text-[10px] text-[var(--text-lo)]">
            key: {category.key} · {draft.active ? "active" : "retired"}
          </p>
        </div>
      </div>
      <Fields draft={draft} onChange={setDraft} keyEditable={false} />
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(draft)}
          className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const next = { ...draft, active: !draft.active };
            setDraft(next);
            save(next);
          }}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-hi)] disabled:opacity-60"
        >
          {draft.active ? "Retire" : "Restore"}
        </button>
      </div>
    </article>
  );
}

function NewCategoryForm() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  const create = async () => {
    setSaving(true);
    const response = await fetch("/api/pulse/wall-of-fame/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ...payload(draft) }),
    });
    setSaving(false);
    const json = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    if (!response.ok)
      return toast.error(json?.error ?? "Could not add the category.");
    toast.success("Category added.");
    setKey("");
    setDraft(EMPTY_DRAFT);
    router.refresh();
  };

  return (
    <section className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--text-hi)]">
        Add a category
      </h2>
      <Fields
        draft={draft}
        onChange={setDraft}
        keyEditable
        keyValue={key}
        onKeyChange={setKey}
      />
      <button
        type="button"
        disabled={saving}
        onClick={create}
        className="mt-4 rounded-lg bg-brand-500 px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Adding…" : "Add category"}
      </button>
    </section>
  );
}

export default function WallOfFameCategoriesAdmin({
  initial,
}: {
  initial: WallOfFameCategory[];
}) {
  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Wall of Fame categories"
        description="Change how each award is described. Retire an award instead of deleting it, so past cycles keep their history."
        icon="solar:cup-star-broken"
      />
      {initial.map((category) => (
        <CategoryCard key={category.key} category={category} />
      ))}
      <NewCategoryForm />
    </div>
  );
}
