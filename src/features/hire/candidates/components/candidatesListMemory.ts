import type { ActiveFilter } from "@/components/ui/UnifiedSearchFilter";

/**
 * Remembers where the recruiter was in the candidates list (search, filters and
 * scroll position) so the list can be restored after viewing an application.
 * Uses sessionStorage, so it lasts for the browser tab and never leaves the device.
 */
const KEY = "kazi:candidates-list";
const MAX_AGE_MS = 30 * 60 * 1000;

export type CandidatesListMemory = {
  search: string;
  filters: ActiveFilter[];
  scrollY: number;
  savedAt: number;
};

export function rememberCandidatesList(
  state: Omit<CandidatesListMemory, "savedAt">,
): void {
  try {
    sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...state, savedAt: Date.now() }),
    );
  } catch {
    // Storage can be unavailable (private mode, blocked); navigation still works.
  }
}

export function recallCandidatesList(): CandidatesListMemory | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as CandidatesListMemory;
    if (Date.now() - saved.savedAt > MAX_AGE_MS) return null;
    return saved;
  } catch {
    return null;
  }
}
