import { Icon } from "@iconify/react";
import Select from "react-select";
import { getSelectStyles } from "./selectStyles";

type SortOrder = 'none' | 'name-asc' | 'name-desc';
interface Props { sortOrder: SortOrder; setSortOrder: (o: SortOrder) => void; mode: 'light' | 'dark'; }

const labels: Record<SortOrder, string> = { none: "No Sorting", "name-asc": "Name (A-Z)", "name-desc": "Name (Z-A)" };

export default function SortOrderSelector({ sortOrder, setSortOrder, mode }: Props) {
  return (
    <div className={`rounded-2xl border p-5 ${mode === "dark" ? "bg-gray-800/50 border-gray-700/50" : "bg-white/80 border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200"}`}>
      <label className={`flex items-center gap-2 text-sm font-semibold mb-3 ${mode === "dark" ? "text-gray-200" : "text-gray-900"}`}>
        <Icon icon="solar:sort-broken" className="w-5 h-5 text-[#f05d23]" />
        Sort Order
      </label>
      <Select
        value={{ value: sortOrder, label: labels[sortOrder] }}
        onChange={(opt) => setSortOrder((opt?.value as SortOrder) || "none")}
        options={[
          { value: "none", label: "No Sorting" },
          { value: "name-asc", label: "Name (A-Z)" },
          { value: "name-desc", label: "Name (Z-A)" },
        ]}
        isClearable={false}
        isSearchable={false}
        className="react-select-container"
        classNamePrefix="react-select"
        styles={{ ...getSelectStyles<any>(mode), menuPortal: (b) => ({ ...b, zIndex: 99999 }) }}
        menuPortalTarget={typeof document !== 'undefined' ? document.body : undefined}
        menuPosition="fixed"
      />
    </div>
  );
}
