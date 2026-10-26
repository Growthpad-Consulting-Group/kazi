"use client";

import { useState } from "react";
import CreatableSelect from "react-select/creatable";
import toast from "react-hot-toast";
import { getSelectStyles, type SelectOption } from "@/components/ui/export/selectStyles";
import { useTheme } from "@/shared/contexts/ThemeContext";

const toOption = (name: string): SelectOption => ({ value: name, label: name });

export function ClientSelect({
  value,
  onChange,
  clients,
  onClientCreated,
}: {
  value: string;
  onChange: (name: string) => void;
  clients: string[];
  onClientCreated: (name: string) => void;
}) {
  const { resolvedMode } = useTheme();
  const [creating, setCreating] = useState(false);

  async function handleCreate(input: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/pulse/daily-log/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: input }),
      });
      const json = await res.json().catch(() => null) as { name?: string; error?: string } | null;
      if (!res.ok || !json?.name) throw new Error(json?.error ?? "Could not add client");
      onClientCreated(json.name);
      onChange(json.name);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add client");
    } finally {
      setCreating(false);
    }
  }

  return (
    <CreatableSelect<SelectOption, false>
      value={value ? toOption(value) : null}
      onChange={(opt) => onChange(opt ? String(opt.value) : "")}
      onCreateOption={handleCreate}
      options={clients.map(toOption)}
      isClearable
      isSearchable
      isDisabled={creating}
      isLoading={creating}
      placeholder="Client (optional)"
      formatCreateLabel={(input) => `+ Add client "${input}"`}
      noOptionsMessage={() => "No clients yet. Type to add one."}
      classNamePrefix="react-select"
      styles={{
        ...getSelectStyles<SelectOption>(resolvedMode),
        menuPortal: (b) => ({ ...b, zIndex: 99999 }),
      }}
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      menuPosition="fixed"
    />
  );
}
