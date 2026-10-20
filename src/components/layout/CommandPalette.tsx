"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import { sidebarNavGroups } from "@/lib/nav";
import { useCommandPalette } from "@/shared/contexts/CommandPaletteContext";

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export default function CommandPalette() {
  const { isOpen: open, close } = useCommandPalette();
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (href: string) => {
    router.push(href);
    close();
  };

  if (!open) return null;

  const allNavItems = sidebarNavGroups.flatMap((g) => g.items);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/50 pt-[15vh]"
      onClick={close}
    >
      <Command
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
          <Icon icon="solar:magnifer-broken" width={16} className="text-[var(--text-lo)]" />
          <Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Jump to a section…"
            className="h-11 flex-1 bg-transparent text-sm text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)]"
          />
          <kbd className="hidden sm:flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-lo)]">
            ESC
          </kbd>
        </div>
        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="px-2 py-6 text-center text-sm text-[var(--text-lo)]">No results.</Command.Empty>
          {sidebarNavGroups.map((group) => (
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
    </div>
  );
}
