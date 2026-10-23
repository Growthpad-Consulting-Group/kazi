"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { GenericTable, type Column, type RowAction } from "@/components/ui/GenericTable";
import UnifiedSearchFilter, { type ActiveFilter, type FilterCategoryDef, type FilterOption } from "@/components/ui/UnifiedSearchFilter";
import { StatusPill } from "@/components/ui/StatusPill";
import StatCard, { type StatCardColor } from "@/components/ui/StatCard";
import type { CandidateWithJob } from "../actions";
import CandidateStageSelect from "./CandidateStageSelect";
import { ScreenButton } from "./ScreenButton";

const STAGE_FILTER_OPTIONS: FilterOption[] = [
  { id: "applied", label: "Applied", category: "stage", value: "applied" },
  { id: "screened", label: "Screened", category: "stage", value: "screened" },
  { id: "interview", label: "Interview", category: "stage", value: "interview" },
  { id: "offer", label: "Offer", category: "stage", value: "offer" },
  { id: "hired", label: "Hired", category: "stage", value: "hired" },
  { id: "rejected", label: "Rejected", category: "stage", value: "rejected" },
];

const FILTER_CATEGORIES: FilterCategoryDef[] = [
  { id: "stage", label: "Stage", icon: "solar:chart-2-broken" },
  { id: "shortlisted", label: "Shortlisted", icon: "solar:star-broken" },
  { id: "role", label: "Role", icon: "solar:case-broken" },
  { id: "source", label: "Source", icon: "solar:link-broken" },
  { id: "location", label: "Location", icon: "solar:map-point-broken" },
  { id: "score", label: "AI score", icon: "solar:cpu-bolt-broken" },
  { id: "cv", label: "CV", icon: "solar:file-text-broken" },
  { id: "attention", label: "Attention", icon: "solar:danger-triangle-broken" },
];

interface Props {
  candidates: CandidateWithJob[];
  unscreenedIds: string[];
  bulkScreenButton?: React.ReactNode;
  initialStage?: string;
  initialAttention?: string;
  initialRole?: string;
}

function dashboardFilters(stage?: string, attention?: string, role?: string): ActiveFilter[] {
  const filters: ActiveFilter[] = [];
  const activeStages = ["applied", "screened", "interview", "offer"];
  const stages = stage === "active" ? activeStages : STAGE_FILTER_OPTIONS.some((option) => option.value === stage) ? [stage!] : [];
  if (stages.length) filters.push({ category: "stage", values: stages, label: `Stage: is ${stage === "active" ? "Active pipeline" : stages[0]}`, operator: "is" });
  if (["needs_screening", "stalled"].includes(attention ?? "")) filters.push({ category: "attention", values: [attention!], label: `Attention: is ${attention!.replaceAll("_", " ")}`, operator: "is" });
  if (role) filters.push({ category: "role", values: [role], label: `Role: is ${role}`, operator: "is" });
  return filters;
}

export default function CandidatesClientView({ candidates, unscreenedIds, bulkScreenButton, initialStage, initialAttention, initialRole }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ActiveFilter[]>(() => dashboardFilters(initialStage, initialAttention, initialRole));
  const [referenceTime] = useState(() => Date.now());

  const categoryOptions = useMemo<Record<string, FilterOption[]>>(() => {
    const unique = (values: (string | null | undefined)[]) => [...new Set(values.filter((value): value is string => !!value))].sort();
    return {
      stage: STAGE_FILTER_OPTIONS,
      shortlisted: [{ id: "yes", label: "Yes", category: "shortlisted", value: "true" }, { id: "no", label: "No", category: "shortlisted", value: "false" }],
      role: unique(candidates.map((candidate) => candidate.jobs?.title)).map((value) => ({ id: value, label: value, category: "role", value })),
      source: unique(candidates.map((candidate) => candidate.source)).map((value) => ({ id: value, label: value, category: "source", value })),
      location: unique(candidates.map((candidate) => candidate.location)).map((value) => ({ id: value, label: value, category: "location", value })),
      score: [{ id: "high", label: "High (75+)", category: "score", value: "high" }, { id: "review", label: "Review (50–74)", category: "score", value: "review" }, { id: "low", label: "Low (<50)", category: "score", value: "low" }, { id: "pending", label: "Not screened", category: "score", value: "pending" }],
      cv: [{ id: "available", label: "CV available", category: "cv", value: "available" }, { id: "missing", label: "CV missing", category: "cv", value: "missing" }],
      attention: [{ id: "needs_screening", label: "Needs screening", category: "attention", value: "needs_screening" }, { id: "stalled", label: "Stalled 14+ days", category: "attention", value: "stalled" }],
    };
  }, [candidates]);

  const filtered = useMemo(() => {
    let list = candidates;
    const fourteenDaysAgo = referenceTime - 14 * 24 * 60 * 60 * 1000;

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.full_name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          (c.jobs?.title ?? "").toLowerCase().includes(q)
      );
    }

    for (const f of filters) {
      if (f.category === "stage") {
        if (f.operator === "is") list = list.filter((c) => f.values.includes(c.stage));
        else list = list.filter((c) => !f.values.includes(c.stage));
      }
      if (f.category === "shortlisted") {
        const wantShortlisted = f.values.includes("true");
        if (f.operator === "is") list = list.filter((c) => c.shortlisted === wantShortlisted);
        else list = list.filter((c) => c.shortlisted !== wantShortlisted);
      }
      if (f.category === "role") list = f.operator === "is" ? list.filter((c) => f.values.includes(c.jobs?.title ?? "")) : list.filter((c) => !f.values.includes(c.jobs?.title ?? ""));
      if (f.category === "source") list = f.operator === "is" ? list.filter((c) => f.values.includes(c.source ?? "")) : list.filter((c) => !f.values.includes(c.source ?? ""));
      if (f.category === "location") list = f.operator === "is" ? list.filter((c) => f.values.includes(c.location ?? "")) : list.filter((c) => !f.values.includes(c.location ?? ""));
      if (f.category === "score") {
        const matches = (c: CandidateWithJob) => f.values.some((value) => value === "pending" ? c.ai_score === null : value === "high" ? (c.ai_score ?? -1) >= 75 : value === "review" ? (c.ai_score ?? -1) >= 50 && (c.ai_score ?? -1) < 75 : c.ai_score !== null && c.ai_score < 50);
        list = f.operator === "is" ? list.filter(matches) : list.filter((candidate) => !matches(candidate));
      }
      if (f.category === "cv") {
        const matches = (c: CandidateWithJob) => f.values.some((value) => value === "available" ? !!(c.cv_url || c.cv_text || c.cv_parsed) : !(c.cv_url || c.cv_text || c.cv_parsed));
        list = f.operator === "is" ? list.filter(matches) : list.filter((candidate) => !matches(candidate));
      }
      if (f.category === "attention") {
        const matches = (c: CandidateWithJob) => f.values.some((value) => value === "needs_screening" ? c.ai_score === null && !!(c.cv_text || c.cv_parsed) : !["hired", "rejected"].includes(c.stage) && new Date(c.applied_at).getTime() < fourteenDaysAgo);
        list = f.operator === "is" ? list.filter(matches) : list.filter((candidate) => !matches(candidate));
      }
    }

    return list;
  }, [candidates, search, filters, referenceTime]);

  const stats = useMemo(() => {
    const stalled = candidates.filter((candidate) => !["hired", "rejected"].includes(candidate.stage) && referenceTime - new Date(candidate.applied_at).getTime() > 14 * 24 * 60 * 60 * 1000).length;
    return [
      { label: "All candidates", value: candidates.length, icon: "solar:users-group-two-rounded-broken", color: "blue", filter: [] as ActiveFilter[] },
      { label: "Needs screening", value: unscreenedIds.length, icon: "solar:cpu-bolt-broken", color: "amber", filter: [{ category: "attention", values: ["needs_screening"], label: "Attention: is Needs screening", operator: "is" as const }] },
      { label: "Interviews", value: candidates.filter((candidate) => candidate.stage === "interview").length, icon: "solar:calendar-broken", color: "blue", filter: [{ category: "stage", values: ["interview"], label: "Stage: is Interview", operator: "is" as const }] },
      { label: "Stalled", value: stalled, icon: "solar:alarm-broken", color: "red", filter: [{ category: "attention", values: ["stalled"], label: "Attention: is Stalled 14+ days", operator: "is" as const }] },
    ] as { label: string; value: number; icon: string; color: StatCardColor; filter: ActiveFilter[] }[];
  }, [candidates, unscreenedIds, referenceTime]);

  const columns: Column<CandidateWithJob>[] = [
    {
      header: "Candidate",
      accessor: "full_name",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-[var(--text-hi)]">{row.full_name}</div>
          <div className="text-xs text-[var(--text-lo)]">{row.email}</div>
        </div>
      ),
    },
    {
      header: "Role",
      accessor: "jobs.title",
      sortable: true,
      render: (row) => <span className="text-[var(--text-lo)]">{row.jobs?.title ?? "—"}</span>,
    },
    {
      header: "Stage",
      accessor: "stage",
      sortable: true,
      render: (row) => <div className="flex flex-col items-start gap-1.5"><StatusPill context="stage" value={row.stage} /><CandidateStageSelect candidateId={row.id} stage={row.stage} /></div>,
    },
    {
      header: "AI Score",
      accessor: "ai_score",
      sortable: true,
      render: (row) =>
        row.ai_score !== null ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-16 rounded-full bg-[var(--surface-2)] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.ai_score}%`,
                  background:
                    row.ai_score >= 65
                      ? "linear-gradient(to right, #22c55e, #16a34a)"
                      : "linear-gradient(to right, #94a3b8, #64748b)",
                }}
              />
            </div>
            <span
              className={`text-xs font-semibold tabular-nums ${row.ai_score >= 65 ? "text-green-500" : "text-[var(--text-lo)]"}`}
            >
              {row.ai_score}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--text-lo)] opacity-50">—</span>
        ),
    },
    {
      header: "Triage",
      accessor: "ai_score",
      render: (row) => row.ai_score === null
        ? <ScreenButton candidateId={row.id} hasCV={!!(row.cv_text || row.cv_parsed)} compact />
        : <span className="text-xs text-[var(--text-lo)]">Screened</span>,
    },
    {
      header: "Shortlisted",
      accessor: "shortlisted",
      render: (row) =>
        row.shortlisted ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-500">
            <Icon icon="solar:check-circle-bold" className="h-3.5 w-3.5" /> Yes
          </span>
        ) : (
          <span className="text-xs text-[var(--text-lo)] opacity-40">—</span>
        ),
    },
    {
      header: "Applied",
      accessor: "applied_at",
      sortable: true,
      render: (row) => (
        <span className="text-xs text-[var(--text-lo)]">
          {new Date(row.applied_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
        </span>
      ),
    },
  ];

  const actions: RowAction<CandidateWithJob>[] = [
    {
      icon: "solar:eye-broken",
      label: "View",
      variant: "info",
      onClick: (row) => router.push(`/hire/candidates/${row.id}`),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => <StatCard key={stat.label} title={stat.label} value={stat.value} icon={stat.icon} color={stat.color} compact onClick={() => setFilters(stat.filter)} />)}
      </div>
      <GenericTable
      data={filtered}
      columns={columns}
      actions={actions}
      onRowClick={(row) => router.push(`/hire/candidates/${row.id}`)}
      emptyMessage="No candidates match your filters."
      emptyIcon="solar:users-group-two-rounded-broken"
      icon="solar:user-speak-broken"
      unifiedSearchFilter={
        <UnifiedSearchFilter
          onSearchChange={setSearch}
          onFilterChange={setFilters}
          filterCategories={FILTER_CATEGORIES}
          categoryOptions={categoryOptions}
          initialFilters={filters}
          searchPlaceholder="Search candidates by name, email or role…"
        />
      }
      rightContent={bulkScreenButton}
      onRefresh={() => { setSearch(""); setFilters([]); }}
      />
    </div>
  );
}
