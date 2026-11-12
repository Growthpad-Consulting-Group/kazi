// Pure validation for Wall of Fame award categories. No database imports, so it can be tested directly.

export type WallOfFameCategory = {
  key: string;
  label: string;
  description: string;
  purpose: string;
  criteria: string[];
  icon: string;
  sort_order: number;
  active: boolean;
};

const KEY_PATTERN = /^[a-z][a-z0-9_]{1,30}$/;
const ICON_PATTERN = /^[a-z0-9-]+:[a-z0-9-]+$/;
const MAX_CRITERIA = 6;

export type CategoryFields = Omit<
  WallOfFameCategory,
  "key" | "sort_order" | "active"
> & {
  sort_order?: number;
  active?: boolean;
};

/** Criteria come from a textarea, one per line. Blank lines are dropped. */
export function parseCriteria(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Validates a create or update. Returns the cleaned fields, or the first problem found. */
export function validateCategoryInput(
  body: Record<string, unknown>,
  { isNew }: { isNew: boolean },
):
  | { ok: true; key: string; fields: CategoryFields }
  | { ok: false; error: string } {
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (isNew && !KEY_PATTERN.test(key))
    return {
      ok: false,
      error:
        "Use 2–31 lowercase letters, numbers or underscores, starting with a letter.",
    };

  const label = typeof body.label === "string" ? body.label.trim() : "";
  if (!label || label.length > 60)
    return {
      ok: false,
      error: "Give the award a name of up to 60 characters.",
    };

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  if (description.length > 300)
    return {
      ok: false,
      error: "The description must be 300 characters or fewer.",
    };

  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
  if (purpose.length > 500)
    return { ok: false, error: "The purpose must be 500 characters or fewer." };

  const criteria = Array.isArray(body.criteria)
    ? body.criteria
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
  if (criteria.length > MAX_CRITERIA)
    return { ok: false, error: `Use at most ${MAX_CRITERIA} criteria.` };
  if (criteria.some((item) => item.length > 120))
    return {
      ok: false,
      error: "Each criterion must be 120 characters or fewer.",
    };

  const icon =
    typeof body.icon === "string" && body.icon.trim()
      ? body.icon.trim()
      : "solar:medal-ribbon-broken";
  if (!ICON_PATTERN.test(icon))
    return {
      ok: false,
      error: "The icon must look like solar:medal-ribbon-broken.",
    };

  const sortOrder =
    body.sort_order === undefined ? undefined : Number(body.sort_order);
  if (
    sortOrder !== undefined &&
    (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999)
  )
    return {
      ok: false,
      error: "The order must be a whole number from 0 to 999.",
    };

  return {
    ok: true,
    key,
    fields: {
      label,
      description,
      purpose,
      criteria,
      icon,
      ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
      ...(typeof body.active === "boolean" ? { active: body.active } : {}),
    },
  };
}
