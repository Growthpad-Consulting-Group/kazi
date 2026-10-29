import { Icon } from "@iconify/react";
import Select from "react-select";
import { getSelectStyles } from "./selectStyles";

type ExportFormat = "csv" | "xlsx" | "pdf" | "email";
interface Props {
  exportFormat: ExportFormat;
  setExportFormat: (f: ExportFormat) => void;
  mode: "light" | "dark";
}

export default function ExportFormatSelector({
  exportFormat,
  setExportFormat,
  mode,
}: Props) {
  return (
    <div
      className={`rounded-2xl border p-5 ${mode === "dark" ? "bg-gray-800/50 border-gray-700/50" : "bg-white/80 border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-200"}`}
    >
      <label
        className={`flex items-center gap-2 text-sm font-semibold mb-3 ${mode === "dark" ? "text-gray-200" : "text-gray-900"}`}
      >
        <Icon icon="solar:export-broken" className="w-5 h-5 text-brand-500" />
        Export Format
      </label>
      <Select
        value={{
          value: exportFormat,
          label:
            exportFormat === "xlsx"
              ? "XLSX (Excel)"
              : exportFormat.toUpperCase(),
        }}
        onChange={(opt) =>
          setExportFormat((opt?.value as ExportFormat) || "csv")
        }
        options={[
          { value: "csv", label: "CSV" },
          { value: "xlsx", label: "XLSX (Excel)" },
          { value: "pdf", label: "PDF" },
          { value: "email", label: "Email" },
        ]}
        isClearable={false}
        isSearchable={false}
        className="react-select-container"
        classNamePrefix="react-select"
        styles={{
          ...getSelectStyles<any>(mode),
          menuPortal: (b) => ({ ...b, zIndex: 99999 }),
        }}
        menuPortalTarget={
          typeof document !== "undefined" ? document.body : undefined
        }
        menuPosition="fixed"
      />
    </div>
  );
}
