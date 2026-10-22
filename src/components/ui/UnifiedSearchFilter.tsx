"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { Icon } from "@iconify/react";
import GlassPanel from "@/components/layout/GlassPanel";
import { useTheme } from "@/shared/contexts/ThemeContext";

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export interface FilterOption   { id: string; label: string; category: string; value: string }
export interface ActiveFilter   { category: string; values: string[]; label: string; operator: "is" | "is_not" }
export interface FilterCategoryDef { id: string; label: string; icon: string }

interface Props {
  onFilterChange: (filters: ActiveFilter[]) => void;
  onSearchChange?: (q: string) => void;
  filterCategories?: FilterCategoryDef[];
  categoryOptions?: Record<string, FilterOption[]>;
  singleSelectCategories?: string[];
  initialFilters?: ActiveFilter[];
  searchPlaceholder?: string;
}

export default function UnifiedSearchFilter({
  onFilterChange,
  onSearchChange,
  filterCategories = [],
  categoryOptions = {},
  singleSelectCategories = [],
  initialFilters,
  searchPlaceholder = "Search and filter…",
}: Props) {
  const { resolvedMode: mode } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>(initialFilters ?? []);
  const [panel, setPanel] = useState<"search" | "values">("search");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedValues, setSelectedValues] = useState<string[]>([]);
  const [operator, setOperator] = useState<"is" | "is_not">("is");
  const [valueSearch, setValueSearch] = useState("");

  const dInput = useDebounce(input, 250);
  const dVSearch = useDebounce(valueSearch, 200);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const externalRef = useRef(false);

  useEffect(() => {
    if (initialFilters) { externalRef.current = true; setActiveFilters(initialFilters); }
  }, [initialFilters]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false); setPanel("search"); setSelectedValues([]); setOperator("is");
      }
    };
    if (isOpen) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [isOpen]);

  useEffect(() => { onSearchChange?.(input); }, [input, onSearchChange]);
  useEffect(() => {
    if (externalRef.current) { externalRef.current = false; return; }
    onFilterChange(activeFilters);
  }, [activeFilters, onFilterChange]);

  const allOptions = useMemo(() =>
    filterCategories.flatMap((cat) =>
      (categoryOptions[cat.id] ?? []).map((o) => ({ ...o, catLabel: cat.label, catIcon: cat.icon }))
    ), [filterCategories, categoryOptions]);

  const suggestions = useMemo(() => {
    if (!dInput.trim()) return [];
    const q = dInput.toLowerCase();
    return [
      ...filterCategories.filter((c) => c.label.toLowerCase().startsWith(q)).map((c) => ({ type: "cat" as const, ...c })),
      ...allOptions.filter((o) => o.label.toLowerCase().includes(q)).map((o) => ({ type: "val" as const, category: o.category, catLabel: o.catLabel, catIcon: o.catIcon, value: o.value, label: o.label })),
    ];
  }, [dInput, filterCategories, allOptions]);

  const applyFilter = useCallback((values: string[], op: "is" | "is_not", catId?: string) => {
    const id = catId ?? selectedCat;
    if (!id) return;
    if (values.length === 0) { setActiveFilters((p) => p.filter((f) => f.category !== id)); return; }
    const catLabel = filterCategories.find((c) => c.id === id)?.label ?? "";
    const isSingle = singleSelectCategories.includes(id);
    const opText = op === "is" ? "is" : "is not";
    const makeLabel = (vals: string[]) => `${catLabel}: ${opText} ${vals.map((v) => allOptions.find((o) => o.value === v)?.label ?? v).join(", ")}`;

    setActiveFilters((prev) => {
      const idx = prev.findIndex((f) => f.category === id);
      if (idx >= 0 && !isSingle) {
        const combined = Array.from(new Set([...prev[idx].values, ...values]));
        return prev.map((f, i) => i === idx ? { ...f, values: combined, label: makeLabel(combined), operator: op } : f);
      } else if (idx >= 0) {
        return prev.map((f, i) => i === idx ? { ...f, values, label: makeLabel(values), operator: op } : f);
      }
      return [...prev, { category: id, values, label: makeLabel(values), operator: op }];
    });
  }, [selectedCat, filterCategories, singleSelectCategories, allOptions]);

  const replaceValues = (vals: string[], op: "is" | "is_not") => {
    if (!selectedCat) return;
    setActiveFilters((p) => p.filter((f) => f.category !== selectedCat));
    if (vals.length > 0) applyFilter(vals, op, selectedCat);
  };

  const selectCategory = (catId: string) => {
    const existing = activeFilters.find((f) => f.category === catId);
    setSelectedCat(catId);
    setSelectedValues(existing?.values ?? []);
    setOperator(existing?.operator ?? "is");
    setPanel("values");
  };

  const currentOptions = (selectedCat ? categoryOptions[selectedCat] ?? [] : [])
    .filter((o) => o.label.toLowerCase().includes(dVSearch.toLowerCase()));

  const dark = mode === "dark";

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Input bar */}
      <div
        onClick={() => { setIsOpen(true); setPanel("search"); inputRef.current?.focus(); }}
        className={`flex w-full cursor-text items-center gap-2 rounded-xl border px-4 py-2 transition-all ${
          dark
            ? `border-white/10 ${isOpen ? "bg-white/10 ring-2 ring-brand-500/40" : "bg-white/5 hover:bg-white/10"}`
            : `border-[var(--border)] ${isOpen ? "bg-white ring-2 ring-brand-500/30" : "bg-[var(--surface-2)] hover:bg-white"}`
        }`}
      >
        <Icon icon="solar:magnifer-broken" className="h-4 w-4 shrink-0 text-[var(--text-lo)]" />

        <div className="flex flex-1 flex-wrap items-center gap-1.5 min-w-0">
          {activeFilters.map((f, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setActiveFilters((p) => p.filter((_, j) => j !== i)); }}
              className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-500 whitespace-nowrap hover:bg-brand-500/20 transition-colors"
            >
              {f.label}
              <Icon icon="solar:close-circle-broken" className="h-3 w-3" />
            </button>
          ))}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={activeFilters.length === 0 ? searchPlaceholder : "Add filter…"}
            className="flex-1 min-w-[120px] bg-transparent text-sm text-[var(--text-hi)] placeholder-[var(--text-lo)] outline-none"
            onFocus={() => { setIsOpen(true); setPanel("search"); }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && input === "" && activeFilters.length > 0) {
                setActiveFilters((p) => p.slice(0, -1));
              }
            }}
          />
        </div>

        {(input || activeFilters.length > 0) && (
          <button onClick={(e) => { e.stopPropagation(); setInput(""); setActiveFilters([]); }}
            className="shrink-0 text-[var(--text-lo)] hover:text-[var(--text-hi)]">
            <Icon icon="solar:close-circle-broken" className="h-4 w-4" />
          </button>
        )}
        <Icon icon="solar:funnel-broken" className="h-4 w-4 shrink-0 text-[var(--text-lo)]" />
      </div>

      {/* Dropdown */}
      {isOpen && (filterCategories.length > 0 || input.trim()) && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80">
          <GlassPanel mode={mode} className={`overflow-hidden rounded-xl ${dark ? "bg-gray-900/70" : "bg-white/90"} shadow-xl backdrop-blur-sm`}>
            {panel === "search" ? (
              <div className="flex max-h-80 flex-col overflow-y-auto p-2 gap-0.5">
                {input.trim() === "" ? (
                  filterCategories.map((cat) => (
                    <button key={cat.id} onClick={() => selectCategory(cat.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${dark ? "text-gray-300 hover:bg-white/10" : "text-[var(--text-hi)] hover:bg-[var(--surface-2)]"}`}>
                      <Icon icon={cat.icon} className="h-4 w-4 text-brand-500" />
                      <span className="flex-1 text-left">{cat.label}</span>
                      <Icon icon="solar:alt-arrow-right-broken" className="h-3.5 w-3.5 opacity-40" />
                    </button>
                  ))
                ) : suggestions.length > 0 ? (
                  suggestions.map((s, i) => (
                    <button key={i}
                      onClick={() => {
                        if (s.type === "val") { applyFilter([s.value], "is", s.category); setInput(""); }
                        else selectCategory(s.id);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        s.type === "val"
                          ? "border border-brand-500/20 bg-brand-500/5 text-brand-500 hover:bg-brand-500/10"
                          : dark ? "text-gray-300 hover:bg-white/10" : "text-[var(--text-hi)] hover:bg-[var(--surface-2)]"
                      }`}>
                      <Icon icon={s.type === "val" ? "solar:check-circle-bold" : "solar:alt-arrow-right-broken"} className="h-4 w-4" />
                      <span className="font-medium">{s.type === "val" ? `${s.catLabel}: ${s.label}` : s.label}</span>
                    </button>
                  ))
                ) : (
                  <p className="py-6 text-center text-xs text-[var(--text-lo)]">No matches</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col">
                <button onClick={() => { setPanel("search"); setSelectedValues([]); }}
                  className={`flex items-center gap-2 border-b px-3 py-3 text-sm font-semibold transition-colors ${dark ? "border-white/10 hover:bg-white/5 text-gray-300" : "border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-hi)]"}`}>
                  <Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />
                  {filterCategories.find((c) => c.id === selectedCat)?.label}
                </button>

                <div className={`border-b px-3 py-2 ${dark ? "border-white/10" : "border-[var(--border)]"}`}>
                  <input value={valueSearch} onChange={(e) => setValueSearch(e.target.value)} placeholder="Search values…" autoFocus
                    className={`w-full rounded-lg border px-2 py-1.5 text-sm outline-none transition-all ${dark ? "bg-white/10 border-white/10 text-gray-100 placeholder-gray-500 focus:border-brand-500" : "bg-[var(--surface-2)] border-[var(--border)] text-[var(--text-hi)] placeholder-[var(--text-lo)] focus:border-brand-500"}`}
                  />
                </div>

                <div className="max-h-48 overflow-y-auto p-2 gap-0.5 flex flex-col">
                  {currentOptions.map((opt) => (
                    <button key={opt.id}
                      onClick={() => {
                        const isSingle = singleSelectCategories.includes(selectedCat ?? "");
                        const vals = selectedValues.includes(opt.value)
                          ? selectedValues.filter((v) => v !== opt.value)
                          : isSingle ? [opt.value] : [...selectedValues, opt.value];
                        setSelectedValues(vals);
                        replaceValues(vals, operator);
                      }}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${dark ? "text-gray-300 hover:bg-white/10" : "text-[var(--text-hi)] hover:bg-[var(--surface-2)]"}`}>
                      <div className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selectedValues.includes(opt.value) ? "bg-brand-500 border-brand-500" : dark ? "border-white/20" : "border-[var(--border)]"}`}>
                        {selectedValues.includes(opt.value) && <Icon icon="solar:check-circle-bold" className="h-3 w-3 text-white" />}
                      </div>
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div className={`border-t p-3 ${dark ? "border-white/10" : "border-[var(--border)]"}`}>
                  <div className={`flex gap-1 rounded-xl p-1 ${dark ? "bg-white/5" : "bg-[var(--surface-2)]"}`}>
                    {(["is", "is_not"] as const).map((op) => (
                      <button key={op} onClick={() => { setOperator(op); replaceValues(selectedValues, op); }}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${operator === op ? "bg-brand-500 text-white shadow-sm" : dark ? "text-gray-400 hover:text-gray-200" : "text-[var(--text-lo)] hover:text-[var(--text-hi)]"}`}>
                        {op === "is" ? "Include" : "Exclude"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
