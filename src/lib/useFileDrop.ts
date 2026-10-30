"use client";

import { useState, type DragEvent } from "react";

/** Keeps only files that match an `accept` string such as "image/*,.pdf". */
function matchesAccept(file: File, accept?: string) {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  return accept
    .split(",")
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .some((token) =>
      token.startsWith(".")
        ? name.endsWith(token)
        : token.endsWith("/*")
          ? file.type.startsWith(token.slice(0, -1))
          : file.type === token,
    );
}

/**
 * Drag-and-drop support for an upload area. Spread `dropProps` on the drop
 * target; `onFiles` receives the dropped files that match `accept`.
 */
export function useFileDrop({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
}: {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const dropProps = {
    onDragEnter: (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      setIsDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLElement>) => {
      if (disabled) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event: DragEvent<HTMLElement>) => {
      if (event.currentTarget.contains(event.relatedTarget as Node | null))
        return;
      setIsDragging(false);
    },
    onDrop: (event: DragEvent<HTMLElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      const files = Array.from(event.dataTransfer.files).filter((file) =>
        matchesAccept(file, accept),
      );
      if (files.length) onFiles(multiple ? files : files.slice(0, 1));
    },
  };

  return { isDragging, dropProps };
}
