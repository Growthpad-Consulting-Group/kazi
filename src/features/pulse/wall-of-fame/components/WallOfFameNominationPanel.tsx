"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@iconify/react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { SlideOver } from "@/components/ui/SlideOver";
import { WallOfFameCategory } from "@/lib/wall-of-fame-category-rules";
import { type Cycle, type Nomination, type Staff } from "./wall-of-fame-model";

export type CategoryOption = Pick<
  WallOfFameCategory,
  "criteria" | "description" | "icon" | "purpose"
> & {
  value: string;
  label: string;
};

type Props = {
  categoryOptions: CategoryOption[];
  canManage: boolean;
  category: string;
  categoryLabel: (key: string) => string;
  currentUserId: string;
  cycle: Cycle;
  finalistsByCategory: Map<string, Set<string>>;
  impact: string;
  isOpen: boolean;
  isSelfNomination: boolean;
  isVoting: boolean;
  month: string;
  nominate: () => void;
  saving: boolean;
  score: number | null;
  selected: Staff | null;
  selectedNominations: Nomination[];
  savePublicHighlight: (nominationId: string, value: string) => void;
  setCategory: (value: string) => void;
  setImpact: (value: string) => void;
  setScore: (value: number | null) => void;
  setSelectedId: (value: string | null) => void;
  submitVote: () => void;
  votingStage: "team" | "management" | null;
};

/** Side panel for nominating a colleague or scoring finalists in the current cycle. */
export default function WallOfFameNominationPanel(props: Props) {
  const {
    categoryOptions,
    canManage,
    category,
    categoryLabel,
    currentUserId,
    finalistsByCategory,
    impact,
    isOpen,
    isSelfNomination,
    isVoting,
    nominate,
    saving,
    score,
    selected,
    selectedNominations,
    savePublicHighlight,
    setCategory,
    setImpact,
    setScore,
    setSelectedId,
    submitVote,
    votingStage,
  } = props;
  const personalEntries = selectedNominations.filter(
    (item) =>
      item.nominator_id === currentUserId && item.nominee_id === currentUserId,
  );
  return (
    <SlideOver
      open={selected !== null}
      onClose={() => setSelectedId(null)}
      title={
        selected
          ? isVoting
            ? `Vote for ${selected.name}`
            : isSelfNomination
              ? "Your monthly project entry"
              : `Nominate ${selected.name}`
          : "Nominate"
      }
      subtitle={
        isVoting
          ? "Review their nomination evidence, then score the impact."
          : isSelfNomination
            ? isOpen
              ? "Choose an award and describe the work you delivered this month."
              : "Your private self-nomination for this award cycle."
            : selected
              ? [selected.job_title, selected.department]
                  .filter(Boolean)
                  .join(" · ") || "Team member"
              : undefined
      }
      icon="solar:star-fall-broken"
    >
      {selected &&
        !isOpen &&
        !isVoting &&
        (isSelfNomination ? (
          <PersonalEntryClosedState
            entries={personalEntries}
            categoryLabel={categoryLabel}
          />
        ) : (
          <ClosedNominationsNotice
            canManage={canManage}
            entries={selectedNominations}
            categoryLabel={categoryLabel}
          />
        ))}

      {selected && isOpen && (
        <div className="space-y-5">
          {isSelfNomination ? (
            <div className="flex items-center gap-3 rounded-xl border border-brand-500/15 bg-brand-500/[0.05] p-3">
              <Avatar
                name={selected.name}
                src={selected.avatar_url}
                size="md"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  Submitting as {selected.name}
                </p>
                <p className="truncate text-xs text-[var(--text-lo)]">
                  {selected.job_title ?? "Team member"}
                  {selected.department ? ` · ${selected.department}` : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <Avatar
                name={selected.name}
                src={selected.avatar_url}
                size="xl"
              />
              <p className="mt-3 text-base font-semibold text-[var(--text-hi)]">
                {selected.name}
              </p>
              <p className="text-xs text-[var(--text-lo)]">
                {selected.job_title ?? "Team member"}
                {selected.department ? ` · ${selected.department}` : ""}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {categoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setCategory(option.value)}
                className={`rounded-xl border p-3 text-left transition-colors ${category === option.value ? "border-brand-500/40 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${category === option.value ? "bg-brand-500 text-white" : "bg-[var(--surface)] text-brand-500"}`}
                >
                  <Icon icon={option.icon} className="h-4 w-4" />
                </span>
                <span className="mt-2 block text-sm font-semibold text-[var(--text-hi)]">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-lo)]">
                  {option.description}
                </span>
              </button>
            ))}
          </div>

          <label className="block text-sm font-semibold text-[var(--text-hi)]">
            {isSelfNomination
              ? "Your impactful work or project"
              : "Impactful work or project"}
            <textarea
              rows={6}
              value={impact}
              onChange={(event) => setImpact(event.target.value)}
              maxLength={1200}
              placeholder={
                isSelfNomination
                  ? "What did you deliver, and what made the client experience exceptional?"
                  : "What did they deliver, and what made the client experience exceptional?"
              }
              className="mt-1.5 w-full resize-y rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-normal leading-relaxed text-[var(--text-hi)] outline-none focus:border-brand-500"
            />
          </label>
          <p className="text-xs leading-relaxed text-[var(--text-lo)]">
            {isSelfNomination
              ? "You can submit one entry across both awards this cycle. Make the impact specific."
              : "You can nominate yourself, but only once per cycle across both awards. Please make the impact specific."}
          </p>
          <Button
            className="w-full"
            icon="solar:star-fall-broken"
            loading={saving}
            disabled={impact.trim().length < 20}
            onClick={nominate}
          >
            {isSelfNomination ? "Submit your entry" : "Submit nomination"}
          </Button>

          {selectedNominations.length > 0 && (
            <NominationEntries
              entries={selectedNominations}
              categoryLabel={categoryLabel}
              withDivider
            />
          )}
        </div>
      )}

      {selected && isVoting && (
        <div className="space-y-5">
          <div className="flex flex-col items-center text-center">
            <Avatar name={selected.name} src={selected.avatar_url} size="xl" />
            <p className="mt-3 text-base font-semibold text-[var(--text-hi)]">
              {selected.name}
            </p>
            <p className="text-xs text-[var(--text-lo)]">
              {selected.job_title ?? "Team member"}
              {selected.department ? ` · ${selected.department}` : ""}
            </p>
          </div>
          {selected.id === currentUserId ? (
            <div className="rounded-xl bg-[var(--surface-2)] p-4 text-center text-sm text-[var(--text-lo)]">
              Self-voting is not available. Choose another colleague.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {categoryOptions
                  .filter((option) => {
                    const nominated = selectedNominations.some(
                      (item) => item.category === option.value,
                    );
                    return votingStage === "management"
                      ? nominated &&
                          !!finalistsByCategory
                            .get(option.value)
                            ?.has(selected.id)
                      : nominated;
                  })
                  .map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setCategory(option.value)}
                      className={`rounded-xl border p-3 text-left transition-colors ${category === option.value ? "border-brand-500/40 bg-brand-500/[0.06]" : "border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)]"}`}
                    >
                      <span className="text-sm font-semibold text-[var(--text-hi)]">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--text-lo)]">
                        {option.description}
                      </span>
                    </button>
                  ))}
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
                <p className="text-xs font-semibold text-[var(--text-hi)]">
                  Public nomination highlights
                </p>
                {selectedNominations
                  .filter((item) => item.category === category)
                  .map((item) =>
                    item.public_highlight ? (
                      <p
                        key={item.id}
                        className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]"
                      >
                        {item.public_highlight}
                      </p>
                    ) : null,
                  )}
                {!selectedNominations.some(
                  (item) =>
                    item.category === category &&
                    Boolean(item.public_highlight),
                ) && (
                  <p className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]">
                    A public highlight has not been approved for this
                    nomination.
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-hi)]">
                  Your score
                </p>
                <p className="mt-1 text-xs text-[var(--text-lo)]">
                  Score their contribution from 1 (limited impact) to 10
                  (exceptional impact).
                </p>
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map(
                    (value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setScore(value)}
                        className={`h-10 rounded-xl border text-sm font-bold transition-colors ${score === value ? "border-brand-500 bg-brand-500 text-white" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-hi)] hover:border-brand-500/50"}`}
                      >
                        {value}
                      </button>
                    ),
                  )}
                </div>
              </div>
              {votingStage === "management" && (
                <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
                  This finalist was selected from the team vote. Your score will
                  determine the winner.
                </p>
              )}
              <Button
                className="w-full"
                icon="solar:star-fall-broken"
                loading={saving}
                disabled={score === null}
                onClick={submitVote}
              >
                Save {votingStage === "team" ? "team" : "management"} vote
              </Button>
            </>
          )}
        </div>
      )}

      {selected && canManage && selectedNominations.length > 0 && (
        <PublicHighlightEditor
          key={selectedNominations
            .map((item) => `${item.id}:${item.public_highlight ?? ""}`)
            .join("|")}
          entries={selectedNominations}
          categoryLabel={categoryLabel}
          onSave={savePublicHighlight}
          saving={saving}
        />
      )}
    </SlideOver>
  );
}

function ClosedNominationsNotice({
  canManage,
  entries,
  categoryLabel,
}: {
  canManage: boolean;
  entries: Nomination[];
  categoryLabel: (key: string) => string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-4 text-center">
      <Icon
        icon="solar:lock-keyhole-broken"
        className="mx-auto h-5 w-5 text-[var(--text-lo)]"
      />
      <p className="mt-2 text-sm font-semibold text-[var(--text-hi)]">
        Nominations are not open
      </p>
      <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
        {canManage
          ? "Open this month’s cycle to start nominating."
          : "Your HR team will open the next Wall of Fame cycle."}
      </p>
      {entries.length > 0 && (
        <NominationEntries entries={entries} categoryLabel={categoryLabel} />
      )}
    </div>
  );
}

function PersonalEntryClosedState({
  entries,
  categoryLabel,
}: {
  entries: Nomination[];
  categoryLabel: (key: string) => string;
}) {
  if (!entries.length)
    return (
      <div className="rounded-xl bg-[var(--surface-2)] p-5 text-center">
        <Icon
          icon="solar:lock-keyhole-broken"
          className="mx-auto h-5 w-5 text-[var(--text-lo)]"
        />
        <p className="mt-2 text-sm font-semibold text-[var(--text-hi)]">
          Nominations are not open
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
          Your HR team will open the next Wall of Fame cycle.
        </p>
      </div>
    );

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-500/20 bg-[var(--surface)] shadow-lg shadow-brand-500/5">
      <div className="flex items-start gap-3 bg-brand-500/[0.06] px-4 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-white shadow-sm">
          <Icon icon="solar:check-circle-broken" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--text-hi)]">
            Your monthly entry is submitted
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
            This entry is private to you and the recognition reviewers.
          </p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {entries.map((entry) => (
          <article
            key={entry.id}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3.5"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded-md bg-brand-500/10 px-2 py-1 font-mono text-[10px] font-bold text-brand-500">
                {categoryLabel(entry.category)}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--text-lo)]">
                <Icon
                  icon="solar:shield-check-broken"
                  className="h-3.5 w-3.5"
                />
                Private entry
              </span>
            </div>
            {entry.impact_statement && (
              <p className="mt-3 text-sm leading-relaxed text-[var(--text-lo)]">
                {entry.impact_statement}
              </p>
            )}
          </article>
        ))}
      </div>
      <div className="border-t border-[var(--border)] px-4 py-3 text-xs leading-relaxed text-[var(--text-lo)]">
        The next nomination window will be announced by HR.
      </div>
    </section>
  );
}

/** The entries submitted for one person this cycle. Shown while nominations are open and after they close. */
function NominationEntries({
  entries,
  categoryLabel,
  withDivider = false,
}: {
  entries: Nomination[];
  categoryLabel: (key: string) => string;
  withDivider?: boolean;
}) {
  return (
    <div
      className={`space-y-3 ${withDivider ? "border-t border-[var(--border)] pt-5" : "pt-2"}`}
    >
      <p className="text-xs font-semibold text-[var(--text-hi)]">
        Nominations this cycle ({entries.length})
      </p>
      {entries.map((item) => (
        <div key={item.id} className="rounded-xl bg-[var(--surface-2)] p-3">
          <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-500">
            {categoryLabel(item.category)}
          </span>
          {item.impact_statement && (
            <p className="mt-2 text-xs leading-relaxed text-[var(--text-lo)]">
              {item.impact_statement}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function PublicHighlightEditor({
  entries,
  categoryLabel,
  onSave,
  saving,
}: {
  entries: Nomination[];
  categoryLabel: (key: string) => string;
  onSave: (id: string, value: string) => void;
  saving: boolean;
}) {
  const [highlights, setHighlights] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      entries.map((item) => [item.id, item.public_highlight ?? ""]),
    ),
  );
  return (
    <section className="space-y-3 border-t border-[var(--border)] pt-5">
      <div>
        <p className="text-sm font-semibold text-[var(--text-hi)]">
          Public voting highlights
        </p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-lo)]">
          Review the original nomination, then publish a concise, anonymised
          summary for staff voting. Original statements remain private.
        </p>
      </div>
      {entries.map((item) => {
        const value = highlights[item.id] ?? "";
        return (
          <div
            key={item.id}
            className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3"
          >
            <span className="rounded-md bg-brand-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-500">
              {categoryLabel(item.category)}
            </span>
            {item.impact_statement && (
              <p className="text-xs leading-relaxed text-[var(--text-lo)]">
                {item.impact_statement}
              </p>
            )}
            <label className="block text-xs font-semibold text-[var(--text-hi)]">
              Public highlight
              <textarea
                rows={3}
                maxLength={500}
                value={value}
                onChange={(event) =>
                  setHighlights((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
                placeholder="An anonymised summary staff can use when voting"
                className="mt-1.5 w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2 text-xs font-normal leading-relaxed text-[var(--text-hi)] outline-none focus:border-brand-500"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-[var(--text-lo)]">
                {value.trim().length
                  ? `${value.trim().length}/500`
                  : "Optional"}
              </span>
              <Button
                size="sm"
                variant={value.trim() ? "primary" : "secondary"}
                loading={saving}
                disabled={Boolean(value.trim()) && value.trim().length < 20}
                onClick={() => onSave(item.id, value)}
              >
                {value.trim() ? "Publish highlight" : "Remove highlight"}
              </Button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
