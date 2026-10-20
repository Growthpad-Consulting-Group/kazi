import toast from "react-hot-toast";

export type DataRow = Record<string, unknown>;
export interface Field { label: string; key: string; icon?: string; }
export type SortOrder = "none" | "name-asc" | "name-desc";
export type SelectedFields = Record<string, boolean>;

export const sortData = <T extends DataRow>(data: T[], sortOrder: SortOrder): T[] => {
  if (sortOrder === "none" || !data || data.length === 0) return data;
  const sorted = [...data];
  switch (sortOrder) {
    case "name-asc": return sorted.sort((a, b) => String(a.name ?? a.title ?? "").localeCompare(String(b.name ?? b.title ?? "")));
    case "name-desc": return sorted.sort((a, b) => String(b.name ?? b.title ?? "").localeCompare(String(a.name ?? a.title ?? "")));
    default: return sorted;
  }
};

export const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${date.getFullYear()}`;
  } catch { return "-"; }
};

function sanitiseValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);
  const obj = value as Record<string, unknown>;
  if (obj.$$typeof || obj._owner) return "[React Component]";
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (obj.name) return String(obj.name);
  try { return JSON.stringify(value); } catch { return "[Complex Object]"; }
}

export const formatRowData = (rows: DataRow[]): DataRow[] =>
  rows.map((row) => {
    const formatted: DataRow = { ...row };
    if (formatted.is_active !== undefined) formatted.is_active = formatted.is_active ? "Active" : "Inactive";
    for (const f of ["created_at", "updated_at", "applied_at", "date"] as const) {
      if (formatted[f]) formatted[f] = formatDate(String(formatted[f]));
    }
    const safe: DataRow = {};
    for (const [k, v] of Object.entries(formatted)) safe[k] = sanitiseValue(v);
    return safe;
  });

export const validateSelectedFields = (selectedFields: SelectedFields): boolean => {
  if (Object.values(selectedFields).every((v) => !v)) {
    toast.error("Please select at least one field to export!");
    return false;
  }
  return true;
};

export const exportXLSX = async (
  formattedRows: DataRow[],
  fieldsOrder: Field[],
  selectedFields: SelectedFields,
  modalTitle: string | undefined
): Promise<void> => {
  if (!validateSelectedFields(selectedFields)) return;
  try {
    const XLSX = await import("xlsx");
    const selectedKeys = fieldsOrder.filter((f) => selectedFields[f.key]).map((f) => f.key);
    const exportData = formattedRows.map((row) => {
      const r: Record<string, string> = {};
      selectedKeys.forEach((key) => {
        const field = fieldsOrder.find((f) => f.key === key);
        if (field) r[field.label] = String(row[key] ?? "");
      });
      return r;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    ws["!cols"] = selectedKeys.map(() => ({ wch: 20 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Export Data");
    const date = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `${modalTitle?.toLowerCase().replace(/\s+/g, "_") ?? "data"}_export_${date}.xlsx`);
    toast.success("XLSX exported successfully!");
  } catch (error) {
    console.error("XLSX export error:", error);
    toast.error("Failed to export XLSX file");
  }
};
