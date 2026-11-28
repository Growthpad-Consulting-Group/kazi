/** Labels for the 1–5 check-in mood scale, as staff see them in the form. */
const CHECKIN_MOOD_LABELS: Record<number, string> = {
  1: "Struggling",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

/** The label for a mood value, or null when no mood was chosen. */
export function checkinMoodLabel(value: unknown): string | null {
  return typeof value === "number"
    ? (CHECKIN_MOOD_LABELS[value] ?? null)
    : null;
}
