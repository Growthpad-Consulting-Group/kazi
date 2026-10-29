export function getNestedValue(
  obj: Record<string, unknown>,
  path: string,
): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc != null && typeof acc === "object")
      return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

export function isDateField(accessor: string): boolean {
  const patterns = [
    "_at",
    "_date",
    "date_",
    "timestamp",
    "created",
    "updated",
    "expires",
  ];
  const a = accessor.toLowerCase();
  return patterns.some((p) => a.includes(p));
}

export function formatDateValue(value: unknown): string {
  if (!value) return "—";
  try {
    return new Date(value as string).toLocaleDateString("en-KE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(value);
  }
}
