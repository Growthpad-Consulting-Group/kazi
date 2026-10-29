"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

const NEXT_LABEL: Record<
  string,
  { button: string; title: string; body: string }
> = {
  pending: {
    button: "Start cycle",
    title: "Start this review cycle?",
    body: "This creates a self review for every active person and a manager review for each person who has a manager. Staff can start their self reviews straight away.",
  },
  self_review: {
    button: "Open manager reviews",
    title: "Move to manager reviews?",
    body: "Self reviews lock for editing. Managers can now complete reviews for their direct reports.",
  },
  manager_review: {
    button: "Open peer reviews",
    title: "Move to peer reviews?",
    body: "Manager reviews lock for editing. Peer reviews open for the peers you've assigned.",
  },
  peer_review: {
    button: "Complete cycle",
    title: "Complete this cycle?",
    body: "All reviews lock and the cycle is closed. This can't be undone.",
  },
};

export function CycleStageButton({
  cycleId,
  status,
}: {
  cycleId: string;
  status: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const next = NEXT_LABEL[status];
  if (!next) return null;

  async function advance() {
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/reviews/${cycleId}/stage`, {
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not move the cycle on.");
      toast.success("Cycle updated");
      setConfirming(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not move the cycle on.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        icon="solar:play-broken"
        onClick={() => setConfirming(true)}
      >
        {next.button}
      </Button>
      <SimpleModal
        open={confirming}
        onClose={() => !saving && setConfirming(false)}
        title={next.title}
        icon="solar:play-broken"
        maxWidth="max-w-md"
      >
        <p className="text-sm leading-6 text-[var(--text-lo)]">{next.body}</p>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button
            variant="secondary"
            disabled={saving}
            onClick={() => setConfirming(false)}
          >
            Cancel
          </Button>
          <Button loading={saving} onClick={advance}>
            {next.button}
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}

export type PlanPerson = {
  id: string;
  name: string;
  jobTitle: string | null;
  managerId: string | null;
};
export type PlanRow = {
  reviewee: PlanPerson;
  self: { submitted: boolean } | null;
  manager: { submitted: boolean; name: string } | null;
  peers: {
    reviewId: string;
    reviewerId: string;
    name: string;
    submitted: boolean;
  }[];
};

function StatusChip({
  label,
  done,
  missing,
}: {
  label: string;
  done: boolean;
  missing?: boolean;
}) {
  if (missing)
    return (
      <span className="rounded-lg bg-[var(--surface-2)] px-2 py-1 text-[10px] font-medium text-[var(--text-lo)]">
        {label}: none
      </span>
    );
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${done ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"}`}
    >
      <Icon
        icon={done ? "solar:check-circle-broken" : "solar:clock-circle-broken"}
        className="h-3 w-3"
      />
      {label}
    </span>
  );
}

function AddPeers({
  cycleId,
  reviewee,
  people,
  excludeIds,
}: {
  cycleId: string;
  reviewee: PlanPerson;
  people: PlanPerson[];
  excludeIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const candidates = people.filter(
    (person) => person.id !== reviewee.id && !excludeIds.includes(person.id),
  );

  async function save() {
    setSaving(true);
    try {
      const response = await fetch(`/api/pulse/reviews/${cycleId}/peers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revieweeId: reviewee.id, peerIds: selected }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? "Could not add peers.");
      toast.success("Peers added");
      setOpen(false);
      setSelected([]);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not add peers.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-500 hover:underline"
      >
        <Icon icon="solar:add-circle-broken" className="h-3.5 w-3.5" /> Add
        peers
      </button>
      <SimpleModal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title={`Peers for ${reviewee.name}`}
        icon="solar:users-group-two-rounded-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--text-lo)]">
            Choose colleagues who worked closely with {reviewee.name}. Each one
            gets a peer review.
          </p>
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-1.5">
            {candidates.map((person) => (
              <label
                key={person.id}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 hover:bg-[var(--surface-2)]"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(person.id)}
                  onChange={() =>
                    setSelected((prev) =>
                      prev.includes(person.id)
                        ? prev.filter((id) => id !== person.id)
                        : [...prev, person.id],
                    )
                  }
                  className="h-4 w-4 accent-brand-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-[var(--text-hi)]">
                    {person.name}
                  </span>
                  {person.jobTitle && (
                    <span className="block truncate text-[11px] text-[var(--text-lo)]">
                      {person.jobTitle}
                    </span>
                  )}
                </span>
              </label>
            ))}
            {candidates.length === 0 && (
              <p className="px-2.5 py-3 text-xs text-[var(--text-lo)]">
                Everyone is already assigned.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button loading={saving} disabled={!selected.length} onClick={save}>
              Add {selected.length || ""} peer{selected.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}

export function ReviewPlan({
  cycleId,
  rows,
  people,
  canAssignAll,
  currentUserId,
}: {
  cycleId: string;
  rows: PlanRow[];
  people: PlanPerson[];
  canAssignAll: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [removing, setRemoving] = useState<string | null>(null);

  async function removePeer(reviewId: string) {
    setRemoving(reviewId);
    try {
      const response = await fetch(`/api/pulse/reviews/${cycleId}/peers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewId }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok)
        throw new Error(data?.error ?? "Could not remove the peer.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove the peer.",
      );
    } finally {
      setRemoving(null);
    }
  }

  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-[var(--text-lo)]">
        Start the cycle to create everyone's reviews.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {rows.map((row) => {
        const canAssign =
          canAssignAll || row.reviewee.managerId === currentUserId;
        return (
          <li
            key={row.reviewee.id}
            className="flex flex-col gap-3 py-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                {row.reviewee.name}
              </p>
              <p className="truncate text-[11px] text-[var(--text-lo)]">
                {row.reviewee.jobTitle ?? "Team member"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {row.self ? (
                <StatusChip label="Self" done={row.self.submitted} />
              ) : (
                <StatusChip label="Self" done={false} missing />
              )}
              {row.manager ? (
                <StatusChip
                  label={`Manager · ${row.manager.name}`}
                  done={row.manager.submitted}
                />
              ) : (
                <StatusChip label="Manager" done={false} missing />
              )}
              {row.peers.map((peer) => (
                <span
                  key={peer.reviewId}
                  className="inline-flex items-center gap-1"
                >
                  <StatusChip
                    label={`Peer · ${peer.name}`}
                    done={peer.submitted}
                  />
                  {!peer.submitted && canAssign && (
                    <button
                      type="button"
                      onClick={() => removePeer(peer.reviewId)}
                      disabled={removing === peer.reviewId}
                      aria-label={`Remove ${peer.name}`}
                      className="rounded p-0.5 text-[var(--text-lo)] hover:text-red-500 disabled:opacity-50"
                    >
                      <Icon
                        icon="solar:close-circle-broken"
                        className="h-3.5 w-3.5"
                      />
                    </button>
                  )}
                </span>
              ))}
              {canAssign && (
                <AddPeers
                  cycleId={cycleId}
                  reviewee={row.reviewee}
                  people={people}
                  excludeIds={row.peers.map((peer) => peer.reviewerId)}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
