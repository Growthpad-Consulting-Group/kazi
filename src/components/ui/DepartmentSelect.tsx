"use client";

import { useState } from "react";
import CreatableSelect from "react-select/creatable";
import toast from "react-hot-toast";
import { createDepartment } from "@/features/departments/actions";
import {
  getSelectStyles,
  type SelectOption,
} from "@/components/ui/export/selectStyles";
import { useTheme } from "@/shared/contexts/ThemeContext";

interface Props {
  value: string;
  onChange: (name: string) => void;
  departments: string[];
  placeholder?: string;
}

const toOption = (name: string): SelectOption => ({ value: name, label: name });

/** Searchable department picker with inline "create new" (like bflowpos categories). */
export default function DepartmentSelect({
  value,
  onChange,
  departments,
  placeholder = "Select or search department...",
}: Props) {
  const { resolvedMode } = useTheme();
  const [created, setCreated] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  const names = Array.from(
    new Set([...departments, ...created, ...(value ? [value] : [])]),
  ).sort((a, b) => a.localeCompare(b));

  async function handleCreate(input: string) {
    setCreating(true);
    try {
      const name = await createDepartment(input);
      setCreated((prev) => [...prev, name]);
      onChange(name);
      toast.success(`Department "${name}" added`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add department");
    } finally {
      setCreating(false);
    }
  }

  return (
    <CreatableSelect<SelectOption, false>
      value={value ? toOption(value) : null}
      onChange={(opt) => onChange(opt ? String(opt.value) : "")}
      onCreateOption={handleCreate}
      options={names.map(toOption)}
      isClearable
      isSearchable
      isDisabled={creating}
      isLoading={creating}
      placeholder={placeholder}
      formatCreateLabel={(input) => `+ Add "${input}"`}
      noOptionsMessage={() => "No departments yet — type to add one"}
      classNamePrefix="react-select"
      styles={{
        ...getSelectStyles<SelectOption>(resolvedMode),
        menuPortal: (b) => ({ ...b, zIndex: 99999 }),
      }}
      menuPortalTarget={
        typeof document !== "undefined" ? document.body : undefined
      }
      menuPosition="fixed"
    />
  );
}
