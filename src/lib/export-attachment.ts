/**
 * export-attachment.ts
 *
 * Builds a file attachment (CSV, XLSX, or PDF) from a data array and
 * returns a Buffer + metadata ready for inclusion in an email attachment.
 */

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface ExportHeader {
  label: string;
  key: string;
}

export interface ExportAttachment {
  content: Buffer;
  filename: string;
  contentType: string;
}

/** RFC-4180 CSV cell escaping. */
function escapeCsv(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return s.includes(",") ||
    s.includes('"') ||
    s.includes("\n") ||
    s.includes("\r")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function buildCsv(
  data: Record<string, unknown>[],
  headers: ExportHeader[],
): Buffer {
  const headerRow = headers.map((h) => escapeCsv(h.label)).join(",");
  const rows = data.map((row) =>
    headers.map((h) => escapeCsv(row[h.key])).join(","),
  );
  const csv = [headerRow, ...rows].join("\n");
  return Buffer.from(csv, "utf-8");
}

async function buildXlsx(
  data: Record<string, unknown>[],
  headers: ExportHeader[],
): Promise<Buffer> {
  // Dynamic import so this module is not bundled unless used.
  const XLSX = await import("xlsx");
  const labeledRows = data.map((row) =>
    Object.fromEntries(headers.map((h) => [h.label, row[h.key] ?? ""])),
  );
  const ws = XLSX.utils.json_to_sheet(labeledRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Export");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf;
}

async function buildPdf(
  data: Record<string, unknown>[],
  headers: ExportHeader[],
  filename: string,
): Promise<Buffer> {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(filename, 14, 16);
  autoTable(doc, {
    head: [headers.map((h) => h.label)],
    body: data.map((row) => headers.map((h) => String(row[h.key] ?? ""))),
    startY: 22,
    theme: "striped",
    headStyles: { fillColor: [240, 93, 35] },
  });
  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

/**
 * Build an email-ready file attachment from a data array.
 *
 * @param format   "csv" | "xlsx" | "pdf"
 * @param data     Array of row objects
 * @param headers  Column definitions (label + key)
 * @param filename Base filename without extension
 */
export async function buildExportAttachment(
  format: ExportFormat,
  data: Record<string, unknown>[],
  headers: ExportHeader[],
  filename: string,
): Promise<ExportAttachment> {
  switch (format) {
    case "csv": {
      const content = buildCsv(data, headers);
      return {
        content,
        filename: `${filename}.csv`,
        contentType: "text/csv; charset=utf-8",
      };
    }
    case "xlsx": {
      const content = await buildXlsx(data, headers);
      return {
        content,
        filename: `${filename}.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
    }
    case "pdf": {
      const content = await buildPdf(data, headers, filename);
      return {
        content,
        filename: `${filename}.pdf`,
        contentType: "application/pdf",
      };
    }
  }
}
