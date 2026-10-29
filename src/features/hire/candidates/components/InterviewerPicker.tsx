"use client";

export type InterviewerOption = {
  id: string;
  name: string;
  job_title: string | null;
};

export function InterviewerPicker({
  interviewers,
  selected,
  currentUserId,
  onToggle,
}: {
  interviewers: InterviewerOption[];
  selected: string[];
  currentUserId: string;
  onToggle: (id: string) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-xs font-medium text-[var(--text-lo)]">
        Interviewers
      </legend>
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-1.5">
        {interviewers.map((person) => {
          const isSelf = person.id === currentUserId;
          return (
            <label
              key={person.id}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-[var(--surface-2)]"
            >
              <input
                type="checkbox"
                checked={selected.includes(person.id)}
                disabled={isSelf}
                onChange={() => onToggle(person.id)}
                className="h-4 w-4 accent-brand-500"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-[var(--text-hi)]">
                  {person.name}
                  {isSelf ? " (you)" : ""}
                </span>
                {person.job_title && (
                  <span className="block truncate text-[11px] text-[var(--text-lo)]">
                    {person.job_title}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
