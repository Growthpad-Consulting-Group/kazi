"use client";

import Select from "react-select";
import {
  getSelectStyles,
  type SelectOption,
} from "@/components/ui/export/selectStyles";
import { useTheme } from "@/shared/contexts/ThemeContext";

function monthOptions(): SelectOption[] {
  const now = new Date();
  return Array.from({ length: 25 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    const label = date.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    return { value, label };
  });
}

export function MonthSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { resolvedMode } = useTheme();
  const options = monthOptions();
  const selected =
    options.find((option) => option.value === value) ??
    (value ? { value, label: value } : null);

  return (
    <Select<SelectOption, false>
      value={selected}
      onChange={(option) => option && onChange(String(option.value))}
      options={options}
      isSearchable
      placeholder="Choose month"
      classNamePrefix="react-select"
      styles={{
        ...getSelectStyles<SelectOption>(resolvedMode),
        menuPortal: (base) => ({ ...base, zIndex: 99999 }),
      }}
      menuPortalTarget={
        typeof document !== "undefined" ? document.body : undefined
      }
      menuPosition="fixed"
    />
  );
}
