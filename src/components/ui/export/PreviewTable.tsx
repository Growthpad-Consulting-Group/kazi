import { memo } from 'react';

interface CsvHeader { key: string; label: string; }
interface Props { filteredUsers: any[]; csvHeaders: CsvHeader[]; previewRows: number; mode: 'light' | 'dark'; }

function PreviewTable({ filteredUsers, csvHeaders, previewRows, mode }: Props) {
  const safeString = (v: any): string => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'function') return '[Function]';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className={`mt-2 rounded-xl border max-h-[180px] overflow-auto ${mode === "dark" ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"}`}>
      <table className="w-full text-xs">
        <thead>
          <tr className={mode === "dark" ? "bg-gray-700" : "bg-gray-100"}>
            {csvHeaders.map((h) => (
              <th key={h.key} className="px-3 py-2 text-left font-semibold whitespace-nowrap">{h.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredUsers.slice(0, previewRows).map((row, i) => (
            <tr key={i} className={`border-t ${mode === "dark" ? "border-gray-700" : "border-gray-200"}`}>
              {csvHeaders.map((h) => (
                <td key={h.key} className="px-3 py-2 whitespace-nowrap max-w-[120px] truncate">{safeString(row[h.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(PreviewTable);
