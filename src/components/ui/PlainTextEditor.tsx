"use client";

import { useRef } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/lib/cn";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  ariaLabel: string;
};

/**
 * A small writing aid that stores plain text. It deliberately avoids rich HTML,
 * keeping check-ins and emails portable, safe to render, and easy to export.
 */
export function PlainTextEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
  className,
  ariaLabel,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function setValue(
    next: string,
    selectionStart?: number,
    selectionEnd?: number,
  ) {
    onChange(next);
    requestAnimationFrame(() => {
      if (ref.current && selectionStart !== undefined) {
        ref.current.focus();
        ref.current.setSelectionRange(
          selectionStart,
          selectionEnd ?? selectionStart,
        );
      }
    });
  }

  function selectedLines() {
    const element = ref.current;
    if (!element) return null;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const lineEndAt = value.indexOf("\n", end);
    return { lineStart, lineEnd: lineEndAt === -1 ? value.length : lineEndAt };
  }

  function toggleList(kind: "bullet" | "number") {
    const range = selectedLines();
    if (!range) return;
    const selected = value.slice(range.lineStart, range.lineEnd);
    const lines = selected.split("\n");
    const expression = kind === "bullet" ? /^•\s/ : /^\d+\.\s/;
    const allListed = lines
      .filter((line) => line.length > 0)
      .every((line) => expression.test(line));
    const nextLines = allListed
      ? lines.map((line) => line.replace(expression, ""))
      : lines.map((line, index) => {
          const text = line.replace(/^•\s|^\d+\.\s/, "");
          return kind === "bullet" ? `• ${text}` : `${index + 1}. ${text}`;
        });
    const replacement = nextLines.join("\n");
    setValue(
      `${value.slice(0, range.lineStart)}${replacement}${value.slice(range.lineEnd)}`,
      range.lineStart,
      range.lineStart + replacement.length,
    );
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;
    const element = event.currentTarget;
    const cursor = element.selectionStart;
    const lineStart = value.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;
    const line = value.slice(lineStart, cursor);
    const bullet = line.match(/^•\s(.*)$/);
    const numbered = line.match(/^(\d+)\.\s(.*)$/);
    if (!bullet && !numbered) return;
    event.preventDefault();
    const text = bullet?.[1] ?? numbered?.[2] ?? "";
    if (!text) {
      const next = `${value.slice(0, lineStart)}${value.slice(cursor)}`;
      setValue(next, lineStart);
      return;
    }
    const prefix = bullet ? "• " : `${Number(numbered?.[1] ?? 0) + 1}. `;
    const next = `${value.slice(0, cursor)}\n${prefix}${value.slice(cursor)}`;
    setValue(next, cursor + prefix.length + 1);
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] focus-within:border-brand-500/60 focus-within:ring-2 focus-within:ring-brand-500/10",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
        <ToolbarButton
          icon="solar:list-broken"
          label="Toggle bullet list"
          onClick={() => toggleList("bullet")}
        />
        <ToolbarButton
          icon="solar:list-check-minimalistic-broken"
          label="Toggle numbered list"
          onClick={() => toggleList("number")}
        />
        <span className="ml-1 text-[10px] text-[var(--text-lo)]">
          Lists stay as simple, editable text.
        </span>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full resize-y bg-transparent px-3 py-2.5 text-sm leading-relaxed text-[var(--text-hi)] outline-none placeholder:text-[var(--text-lo)]"
      />
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--text-lo)] transition-colors hover:bg-[var(--surface)] hover:text-brand-500"
    >
      <Icon icon={icon} className="h-4 w-4" />
    </button>
  );
}
