"use client";

import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { hallOfFameChannelName } from "@/lib/hall-of-fame-channel";
import Image from "next/image";
import { Avatar } from "@/components/ui/Avatar";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import SetPageHeader from "@/components/ui/SetPageHeader";
import DateRangePicker, {
  type DateRangeValue,
} from "@/components/ui/DateRangePicker";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { SlideOver } from "@/components/ui/SlideOver";
import StatCard from "@/components/ui/StatCard";
import { MonthSelect } from "./MonthSelect";

type Cycle = {
  id: string;
  month: string;
  status: "draft" | "open" | "closed";
  opens_at: string | null;
  closes_at: string | null;
} | null;
type Staff = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
};
type Nomination = {
  id: string;
  nominator_id: string;
  nominee_id: string;
  impact_statement: string;
  category: "wow" | "mvp";
  created_at: string;
};

const CATEGORY_OPTIONS = [
  { value: "wow", label: "WOW Award", description: "Delivered a WOW experience to a client", icon: "solar:magic-stick-3-broken" },
  { value: "mvp", label: "MVP of the month", description: "Excellent performance this month", icon: "solar:medal-ribbon-broken" },
] as const;

function monthLabel(month: string) {
  return new Date(`${month}T12:00:00`).toLocaleDateString("en-KE", {
    month: "long",
    year: "numeric",
  });
}

function toDateString(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export default function HallOfFameClient({
  currentUserId,
  canManage,
  cycle,
  staff,
  nominations,
}: {
  currentUserId: string;
  canManage: boolean;
  cycle: Cycle;
  staff: Staff[];
  nominations: Nomination[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [impact, setImpact] = useState("");
  const [category, setCategory] = useState<"wow" | "mvp">("wow");
  const [saving, setSaving] = useState(false);
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [month, setMonth] = useState(
    `${new Date().toISOString().slice(0, 7)}-01`,
  );
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const nominationWindow: DateRangeValue = {
    startDate: opensAt ? new Date(`${opensAt}T00:00:00`) : null,
    endDate: closesAt ? new Date(`${closesAt}T00:00:00`) : null,
  };

  const nominationsByNominee = useMemo(
    () =>
      nominations.reduce<Record<string, Nomination[]>>((all, item) => {
        (all[item.nominee_id] ??= []).push(item);
        return all;
      }, {}),
    [nominations],
  );

  const directory = useMemo(
    () =>
      staff
        .filter((member) => {
          const query = search.trim().toLowerCase();
          if (!query) return true;
          return (
            member.name.toLowerCase().includes(query) ||
            (member.job_title ?? "").toLowerCase().includes(query) ||
            (member.department ?? "").toLowerCase().includes(query)
          );
        })
        .sort(
          (a, b) =>
            (nominationsByNominee[b.id]?.length ?? 0) -
              (nominationsByNominee[a.id]?.length ?? 0) ||
            a.name.localeCompare(b.name),
        ),
    [staff, search, nominationsByNominee],
  );

  const selected = staff.find((member) => member.id === selectedId) ?? null;
  const selectedNominations = selected
    ? nominationsByNominee[selected.id] ?? []
    : [];
  const nomineeCount = Object.keys(nominationsByNominee).length;
  const yourNominations = nominations.filter(
    (item) => item.nominator_id === currentUserId,
  ).length;
  const isOpen = cycle?.status === "open";

  const openNominate = (id: string) => {
    setSelectedId(id);
    setImpact("");
    setCategory("wow");
  };

  const nominate = async () => {
    if (!cycle || !selected || impact.trim().length < 20) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cycleId: cycle.id,
          nomineeId: selected.id,
          impactStatement: impact,
          category,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(`Nominated ${selected.name}.`);
      setSelectedId(null);
      setImpact("");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit nomination.",
      );
    } finally {
      setSaving(false);
    }
  };

  const createCycle = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          opensAt: opensAt || null,
          closesAt: closesAt || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success("Nominations are open.");
      setNewCycleOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not open nominations.",
      );
    } finally {
      setSaving(false);
    }
  };

  const closeCycle = async () => {
    if (!cycle) return;
    setSaving(true);
    try {
      const response = await fetch("/api/pulse/hall-of-fame/cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cycle.id, status: "closed" }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      toast.success("Nominations closed.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not close nominations.",
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!cycle) return;
    const channel = supabaseBrowser
      .channel(hallOfFameChannelName(cycle.id))
      .on("broadcast", { event: "changed" }, () => router.refresh())
      .subscribe();
    return () => {
      void supabaseBrowser.removeChannel(channel);
    };
  }, [cycle, router]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <SetPageHeader
        title={cycle ? `${monthLabel(cycle.month)} · Wall of Fame` : "Growthpad Wall of Fame"}
        description="Recognise people who create WOW experiences for clients and deliver excellent performance."
        icon="solar:cup-star-broken"
        trailing={canManage ? (
          <Button
            size="sm"
            variant={isOpen ? "secondary" : "primary"}
            icon={isOpen ? "solar:lock-keyhole-broken" : "solar:add-circle-broken"}
            loading={saving}
            onClick={isOpen ? closeCycle : () => setNewCycleOpen(true)}
          >
            {isOpen ? "Close nominations" : "Open nominations"}
          </Button>
        ) : undefined}
      />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard variant="inline" compact title="Nominations" value={nominations.length} icon="solar:star-fall-broken" color="orange" subtitle="This award cycle" />
        <StatCard variant="inline" compact title="Nominees" value={nomineeCount} icon="solar:users-group-two-rounded-broken" color="green" subtitle="Colleagues recognised" />
        <StatCard variant="inline" compact title="Your nominations" value={yourNominations} icon="solar:heart-angle-broken" color="blue" subtitle="Your voice this month" />
        <StatCard variant="inline" compact title="Awards" value="WOW · MVP" icon="solar:medal-ribbon-broken" color="amber" subtitle="Client excellence" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-hi)]">Staff directory</h2>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              {isOpen
                ? "Select a colleague to nominate them."
                : "Nominations are closed. Open a cycle to nominate."}
            </p>
          </div>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, role or team"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:border-brand-500 sm:w-72"
          />
        </div>
        {directory.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-[var(--text-lo)]">No staff match your search.</div>
        ) : (
          <div className="grid max-h-[72vh] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 sm:gap-4 sm:p-5 lg:grid-cols-4 xl:grid-cols-5">
            {directory.map((member) => {
              const received = nominationsByNominee[member.id] ?? [];
              const wow = received.filter((item) => item.category === "wow").length;
              const mvp = received.filter((item) => item.category === "mvp").length;
              const initialsText = member.name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => openNominate(member.id)}
                  className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] text-left shadow-lg shadow-slate-200/40 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl dark:shadow-black/30"
                >
                  {member.avatar_url ? (
                    <Image
                      src={member.avatar_url}
                      alt={member.name}
                      fill
                      sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand-500/30 via-orange-400/20 to-violet-500/20 font-mono text-4xl font-bold text-[var(--text-hi)]/70">
                      {initialsText}
                    </span>
                  )}
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                  {(wow > 0 || mvp > 0) && (
                    <div className="absolute right-2.5 top-2.5 flex flex-col items-end gap-1">
                      {wow > 0 && <span className="rounded-lg bg-brand-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white shadow-lg">WOW × {wow}</span>}
                      {mvp > 0 && <span className="rounded-lg bg-white/90 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-900 shadow-lg">MVP × {mvp}</span>}
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 p-3.5">
                    <p className="truncate text-sm font-semibold text-white">
                      {member.name}
                      {member.id === currentUserId ? <span className="font-normal text-white/60"> (you)</span> : null}
                    </p>
                    <p className="truncate text-[11px] text-white/70">
                      {member.job_title ?? "Team member"}
                    </p>
                    <p className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/80 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                      {isOpen ? "Nominate" : "View"} <Icon icon="solar:alt-arrow-right-broken" className="h-3 w-3" />
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <SlideOver
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        title={selected ? `Nominate ${selected.name}` : "Nominate"}
        subtitle={selected ? [selected.job_title, selected.department].filter(Boolean).join(" · ") || "Team member" : undefined}
        icon="solar:star-fall-broken"
      >
        {selected && !isOpen && (
          <div className="rounded-xl bg-[var(--surface-2)] p-4 text-center">
            <Icon icon="solar:lock-keyhole-broken" className="mx-auto h-5 w-5 text-[var(--text-lo)]" />
            <p className="mt-2 text-xs font-semibold text-[var(--text-hi)]">Nominations are not open</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-lo)]">
              {canManage ? "Open this month’s cycle to start nominating." : "Your HR team will open the next Wall of Fame cycle."}
            </p>
          </div>
        )}

        {selected && isOpen && (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center">
              <Avatar name={selected.name} src={selected.avatar_url} size="xl" />
              <p className="mt-3 text-base font-semibold text-[var(--text-hi)]">{selected.name}</p>
              <p className="text-xs text-[var(--text-lo)]">{selected.job_title ?? "Team member"}{selected.department ? ` · ${selected.department}` : ""}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={`rounded-xl border p-3 text-left transition-colors ${category === option.value ? "border-brand-500/40 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${category === option.value ? "bg-brand-500 text-white" : "bg-[var(--surface)] text-brand-500"}`}>
                    <Icon icon={option.icon} className="h-4 w-4" />
                  </span>
                  <span className="mt-2 block text-xs font-semibold text-[var(--text-hi)]">{option.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--text-lo)]">{option.description}</span>
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-[var(--text-hi)]">
              Impactful work or project
              <textarea
                rows={6}
                value={impact}
                onChange={(event) => setImpact(event.target.value)}
                maxLength={1200}
                placeholder="What did they deliver, and what made the client experience exceptional?"
                className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-normal leading-relaxed text-[var(--text-hi)] outline-none focus:border-brand-500"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-[var(--text-lo)]">
              You can nominate yourself, but only once per cycle across both awards. Please make the impact specific.
            </p>
            <Button
              className="w-full"
              icon="solar:star-fall-broken"
              loading={saving}
              disabled={impact.trim().length < 20}
              onClick={nominate}
            >
              Submit nomination
            </Button>

            {selectedNominations.length > 0 && (
              <div className="space-y-3 border-t border-[var(--border)] pt-5">
                <p className="text-xs font-semibold text-[var(--text-hi)]">
                  Nominations this cycle ({selectedNominations.length})
                </p>
                {selectedNominations.map((item) => (
                  <div key={item.id} className="rounded-xl bg-[var(--surface-2)] p-3">
                    <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-500">
                      {item.category === "wow" ? "WOW Award" : "MVP of the month"}
                    </span>
                    <p className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]">{item.impact_statement}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SlideOver>

      <SimpleModal
        open={newCycleOpen}
        onClose={() => setNewCycleOpen(false)}
        title="Open Wall of Fame nominations"
        icon="solar:cup-star-broken"
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-[var(--text-lo)]">
            Open a monthly cycle for staff nominations.
          </p>
          <label className="block text-xs font-semibold text-[var(--text-hi)]">
            Award month
            <div className="mt-1.5">
              <MonthSelect value={month} onChange={setMonth} />
            </div>
          </label>
          <div className="block text-xs font-semibold text-[var(--text-hi)]">
            Nomination window
            <div className="mt-1.5">
              <DateRangePicker
                value={nominationWindow}
                onChange={(range) => {
                  setOpensAt(range.startDate ? toDateString(range.startDate) : "");
                  setClosesAt(range.endDate ? toDateString(range.endDate) : "");
                }}
                allowedRanges={["Custom Range"]}
                maxDate={null}
                fullWidth
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" onClick={() => setNewCycleOpen(false)}>
              Cancel
            </Button>
            <Button
              loading={saving}
              disabled={!!(opensAt && closesAt && closesAt < opensAt)}
              onClick={createCycle}
            >
              Open nominations
            </Button>
          </div>
        </div>
      </SimpleModal>
    </div>
  );
}
