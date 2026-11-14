"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import Select, {
  components,
  type OptionProps,
  type SingleValue,
  type SingleValueProps,
} from "react-select";
import type { HireCompanyAccess } from "@/lib/hire-company-access";
import { ALL_HIRE_WORKSPACES } from "@/lib/hire-workspace-constants";
import { getSelectStyles } from "@/components/ui/export/selectStyles";
import { useTheme } from "@/shared/contexts/ThemeContext";

type WorkspaceOption = {
  value: string;
  label: string;
  isAggregate?: boolean;
};

function WorkspaceOptionLabel(props: OptionProps<WorkspaceOption, false>) {
  return (
    <components.Option {...props}>
      <span className="flex items-center gap-2">
        <Icon
          icon={
            props.data.isAggregate
              ? "solar:buildings-3-broken"
              : "solar:buildings-2-broken"
          }
          className={`h-4 w-4 ${props.isSelected ? "text-white" : "text-brand-500"}`}
        />
        <span>{props.data.label}</span>
      </span>
    </components.Option>
  );
}

function WorkspaceSingleValue(props: SingleValueProps<WorkspaceOption, false>) {
  return (
    <components.SingleValue {...props}>
      {props.data.label}
    </components.SingleValue>
  );
}

export default function HireWorkspaceSwitcher({
  companies,
  activeSlug,
}: {
  companies: HireCompanyAccess[];
  activeSlug: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { resolvedMode } = useTheme();

  const options: WorkspaceOption[] = [
    ...(companies.length > 1
      ? [
          {
            value: ALL_HIRE_WORKSPACES,
            label: "All authorised companies",
            isAggregate: true,
          },
        ]
      : []),
    ...companies.map((company) => ({
      value: company.slug,
      label: company.displayName,
    })),
  ];

  if (companies.length < 2) {
    return (
      <div className="hidden items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-hi)] sm:flex">
        <Icon
          icon="solar:buildings-2-broken"
          className="h-4 w-4 text-brand-500"
        />
        {companies[0]?.displayName}
      </div>
    );
  }

  function selectWorkspace(slug: string) {
    if (slug === activeSlug) return;
    startTransition(async () => {
      try {
        const response = await fetch("/api/hire/workspace", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ company: slug }),
        });
        if (!response.ok) throw new Error("Could not switch workspace");
        const params = new URLSearchParams(searchParams.toString());
        params.set("company", slug);
        // Record-specific filters can point to a role in another workspace.
        params.delete("job");
        const query = params.toString();
        router.replace(query ? `${pathname}?${query}` : pathname);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not switch workspace",
        );
      }
    });
  }

  const selected =
    options.find((option) => option.value === activeSlug) ?? options[0] ?? null;

  return (
    <div className="flex h-9 min-w-52 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-sm text-[var(--text-lo)] shadow-sm transition-colors hover:border-brand-500/50 sm:min-w-64">
      <Icon
        icon="solar:buildings-2-broken"
        className="ml-1 h-4 w-4 shrink-0 text-brand-500"
      />
      <Select<WorkspaceOption, false>
        aria-label="Hire workspace"
        className="min-w-0 flex-1"
        classNamePrefix="react-select"
        isDisabled={isPending}
        isSearchable
        placeholder="Search workspace…"
        menuPortalTarget={
          typeof document === "undefined" ? undefined : document.body
        }
        options={options}
        value={selected}
        onChange={(option: SingleValue<WorkspaceOption>) => {
          if (option) selectWorkspace(option.value);
        }}
        styles={{
          ...getSelectStyles<WorkspaceOption>(resolvedMode ?? "light"),
          control: (provided, state) => ({
            ...getSelectStyles<WorkspaceOption>(resolvedMode ?? "light")
              .control!(provided, state),
            minHeight: "34px",
            border: 0,
            backgroundColor: "transparent",
          }),
          menuPortal: (provided) => ({ ...provided, zIndex: 20000 }),
        }}
        components={{
          IndicatorSeparator: null,
          DropdownIndicator: components.DropdownIndicator,
          Option: WorkspaceOptionLabel,
          SingleValue: WorkspaceSingleValue,
        }}
      />
    </div>
  );
}
