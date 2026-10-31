"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

type Template = {
  id: string;
  name: string;
  scope: string;
  scope_value: string | null;
};
type Criterion = { name: string; weight: number; guidance: string };
const defaultCriteria: Criterion[] = [
  "Quality of work",
  "Communication",
  "Collaboration",
  "Initiative & ownership",
  "Growth & development",
].map((name) => ({ name, weight: 20, guidance: "" }));

export function NewCompetencyTemplateButton({
  onCreated,
}: {
  onCreated: (template: Template) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scope, setScope] = useState("company");
  const [scopeValue, setScopeValue] = useState("");
  const [criteria, setCriteria] = useState(defaultCriteria);
  const [saving, setSaving] = useState(false);
  const total = criteria.reduce(
    (sum, item) => sum + (Number(item.weight) || 0),
    0,
  );
  async function create() {
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/review-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scope, scopeValue, criteria }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      onCreated(data);
      setOpen(false);
      setName("");
      toast.success("Competency template created");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not create template.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 text-[11px] font-semibold text-brand-500 hover:underline"
      >
        Create template
      </button>
      <SimpleModal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="New competency template"
        icon="solar:widget-add-broken"
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[var(--text-hi)]">
              Template name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="text-xs font-semibold text-[var(--text-hi)]">
              Scope
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm font-normal"
              >
                <option value="company">Company-wide</option>
                <option value="department">Department</option>
                <option value="role">Role</option>
              </select>
            </label>
          </div>
          {scope !== "company" && (
            <input
              value={scopeValue}
              onChange={(event) => setScopeValue(event.target.value)}
              placeholder={scope === "department" ? "Department" : "Role title"}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            />
          )}
          <div>
            <div className="flex justify-between text-xs font-semibold">
              <span>Competencies and weights</span>
              <span
                className={total === 100 ? "text-emerald-600" : "text-red-500"}
              >
                {total}/100%
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {criteria.map((item, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_64px] gap-2 rounded-xl bg-[var(--surface-2)] p-2"
                >
                  <div>
                    <input
                      value={item.name}
                      onChange={(event) =>
                        setCriteria((all) =>
                          all.map((current, i) =>
                            i === index
                              ? { ...current, name: event.target.value }
                              : current,
                          ),
                        )
                      }
                      className="w-full bg-transparent text-sm font-medium outline-none"
                    />
                    <input
                      value={item.guidance}
                      onChange={(event) =>
                        setCriteria((all) =>
                          all.map((current, i) =>
                            i === index
                              ? { ...current, guidance: event.target.value }
                              : current,
                          ),
                        )
                      }
                      placeholder="Reviewer guidance"
                      className="mt-1 w-full bg-transparent text-xs outline-none"
                    />
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={item.weight}
                    onChange={(event) =>
                      setCriteria((all) =>
                        all.map((current, i) =>
                          i === index
                            ? { ...current, weight: Number(event.target.value) }
                            : current,
                        ),
                      )
                    }
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={
                !name || total !== 100 || criteria.some((item) => !item.name)
              }
              onClick={create}
            >
              Create template
            </Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
