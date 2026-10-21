"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { useSession } from "next-auth/react";
import { navigationForRole } from "@/lib/nav";
import { useCommandPalette } from "@/shared/contexts/CommandPaletteContext";
import { SimpleModal } from "@/components/ui/SimpleModal";

type SearchResult = {
  id: string;
  label: string;
  detail: string;
  href: string;
  kind: "staff" | "candidate" | "job" | "goal" | "review" | "signature";
};

const resultMeta: Record<SearchResult["kind"], { label: string; icon: string }> = {
  staff: { label: "Staff", icon: "solar:users-group-two-rounded-broken" },
  candidate: { label: "Candidate", icon: "solar:user-plus-broken" },
  job: { label: "Job", icon: "solar:case-round-broken" },
  goal: { label: "Goal", icon: "solar:flag-broken" },
  review: { label: "Review cycle", icon: "solar:clipboard-list-broken" },
  signature: { label: "Signature staff", icon: "solar:document-text-broken" },
};

export default function CommandPalette() {
  const { isOpen: open, close } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const navGroups = navigationForRole(session?.user?.role);

  useEffect(() => {
    if (!open) {
      const frame = window.requestAnimationFrame(() => {
        setQuery("");
        setResults([]);
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [open]);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      const frame = window.requestAnimationFrame(() => {
        setResults([]);
        setIsSearching(false);
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        const data = await response.json() as { results?: SearchResult[] };
        if (response.ok) setResults(data.results ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  const go = (href: string) => {
    router.push(href);
    close();
  };

  return (
    <SimpleModal open={open} onClose={close} title="Search Kazi" icon="solar:magnifer-broken" maxWidth="max-w-lg">
      <Command
        className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-2)]/45"
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
          <Icon icon="solar:magnifer-broken" width={16} className="text-[var(--text-lo)]" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Search staff, candidates, jobs, goals…"
            className="h-11 flex-1 bg-transparent text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)]"
          />
          <kbd className="hidden sm:flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-lo)]">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-[min(24rem,calc(90vh-180px))] overflow-y-auto p-2">
          <Command.Empty className="px-2 py-6 text-center text-sm text-[var(--text-lo)]">{isSearching ? "Searching…" : "No results."}</Command.Empty>
          {results.length > 0 && <Command.Group
            heading="Search results"
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[var(--text-lo)]"
          >
            {results.map((result) => {
              const meta = resultMeta[result.kind];
              return <Command.Item key={`${result.kind}-${result.id}`} value={`${result.label} ${result.detail}`} onSelect={() => go(result.href)} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-[var(--text-hi)] data-[selected=true]:bg-[var(--surface-2)] aria-selected:bg-[var(--surface-2)]">
                <Icon icon={meta.icon} width={16} className="text-[#f05d23]" />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{result.label}</span><span className="block truncate text-xs text-[var(--text-lo)]">{result.detail}</span></span>
                <span className="hidden rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-lo)] sm:block">{meta.label}</span>
              </Command.Item>;
            })}
          </Command.Group>}
          {navGroups.map((group) => (
            <Command.Group
              key={group.category}
              heading={group.category}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-mono [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:text-[var(--text-lo)]"
            >
              {group.items.map((item) => (
                <Command.Item
                  key={item.href}
                  value={item.label}
                  onSelect={() => go(item.href)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-[var(--text-hi)] data-[selected=true]:bg-[var(--surface-2)] aria-selected:bg-[var(--surface-2)]"
                >
                  <Icon icon={item.icon} width={16} className="text-[var(--text-lo)]" />
                  <span className="flex-1">{item.label}</span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </SimpleModal>
  );
}
