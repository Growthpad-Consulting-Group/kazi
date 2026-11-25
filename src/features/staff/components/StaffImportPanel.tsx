"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { parseCsv } from "@/lib/csv";

const COLUMNS = [
  "name",
  "email",
  "password",
  "role",
  "department",
  "job_title",
  "location",
  "manager_email",
  "start_date",
] as const;
const REQUIRED = ["name", "email", "password"] as const;

type ParsedRow = Partial<Record<(typeof COLUMNS)[number], string>>;
type Failure = { line: number; email: string; error?: string };

function downloadTemplate() {
  const csv = `${COLUMNS.join(",")}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "kazi-staff-import-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function StaffImportPanel({ onImported }: { onImported: () => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    failed: Failure[];
  } | null>(null);

  const missingRequired = rows.filter((row) =>
    REQUIRED.some((column) => !row[column]?.trim()),
  ).length;

  async function readFile(file: File | undefined) {
    setResult(null);
    setRows([]);
    setParseError("");
    setFileName(file?.name ?? "");
    if (!file) return;
    const table = parseCsv(await file.text());
    if (table.length < 2) {
      setParseError("The file needs a header row and at least one person.");
      return;
    }
    const headers = table[0].map((header) =>
      header.trim().toLowerCase().replace(/\s+/g, "_"),
    );
    const missingHeaders = REQUIRED.filter((c) => !headers.includes(c));
    if (missingHeaders.length) {
      setParseError(`Missing column: ${missingHeaders.join(", ")}.`);
      return;
    }
    setRows(
      table.slice(1).map((cells) => {
        const row: ParsedRow = {};
        headers.forEach((header, index) => {
          const column = COLUMNS.find((c) => c === header);
          if (column) row[column] = cells[index] ?? "";
        });
        return row;
      }),
    );
  }

  async function importRows() {
    setImporting(true);
    try {
      const response = await fetch("/api/staff/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = (await response.json().catch(() => null)) as {
        created?: number;
        failed?: Failure[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? "Import failed.");
      setResult({ created: data?.created ?? 0, failed: data?.failed ?? [] });
      if ((data?.created ?? 0) > 0) onImported();
      toast.success(`${data?.created ?? 0} staff added`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          icon="solar:download-broken"
          onClick={downloadTemplate}
        >
          Download template
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          className="text-sm text-[var(--text-lo)]"
          onChange={(event) => readFile(event.target.files?.[0])}
        />
      </div>

      <p className="text-xs leading-5 text-[var(--text-lo)]">
        Columns: name, email, password, role, department, job_title, location,
        manager_email, start_date. Name, email and password are required. The
        file contains temporary passwords, so delete it after importing.
      </p>

      {parseError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">
          {parseError}
        </p>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-[var(--border)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-xs text-[var(--text-lo)]">
            {fileName} · {rows.length} {rows.length === 1 ? "person" : "people"}
            {missingRequired > 0 &&
              ` · ${missingRequired} missing a required field`}
          </div>
          <ul className="max-h-48 divide-y divide-[var(--border)] overflow-auto text-sm">
            {rows.slice(0, 50).map((row, index) => (
              <li key={index} className="flex justify-between gap-3 px-3 py-2">
                <span className="truncate text-[var(--text-hi)]">
                  {row.name || "—"}
                </span>
                <span className="truncate text-[var(--text-lo)]">
                  {row.email || "—"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm">
          <p className="font-semibold text-[var(--text-hi)]">
            {result.created} added
            {result.failed.length > 0 && `, ${result.failed.length} not added`}
          </p>
          {result.failed.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-red-600">
              {result.failed.map((failure) => (
                <li key={failure.line}>
                  Line {failure.line} ({failure.email || "no email"}):{" "}
                  {failure.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-end border-t border-[var(--border)] pt-4">
        <Button
          icon="solar:upload-broken"
          loading={importing}
          disabled={rows.length === 0 || missingRequired > 0 || importing}
          onClick={importRows}
        >
          {importing ? "Importing" : `Import ${rows.length || ""}`.trim()}
        </Button>
      </div>
    </div>
  );
}
