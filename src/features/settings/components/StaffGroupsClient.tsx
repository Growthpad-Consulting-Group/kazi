"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";
import type { StaffGroup } from "@/types/database";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

interface Props {
  initial: StaffGroup[];
  users: { id: string; name: string }[];
}

export function StaffGroupsClient({ initial, users }: Props) {
  const [groups, setGroups] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [groupToManage, setGroupToManage] = useState<StaffGroup | null>(null);
  const [managingIds, setManagingIds] = useState<string[]>([]);
  const [updatingMembers, setUpdatingMembers] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<StaffGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  function toggleMember(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function openModal() {
    setGroupName("");
    setSelectedIds([]);
    setModalOpen(true);
  }

  function openManageModal(group: StaffGroup) {
    setGroupToManage(group);
    setManagingIds(group.member_ids);
  }

  function toggleManagedMember(id: string) {
    setManagingIds((prev) =>
      prev.includes(id)
        ? prev.filter((memberId) => memberId !== id)
        : [...prev, id],
    );
  }

  async function handleCreate() {
    if (!groupName.trim() || selectedIds.length < 2) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pulse/staff-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          member_ids: selectedIds,
        }),
      });
      const data = (await res.json()) as { error?: string; group?: StaffGroup };
      if (!res.ok) throw new Error(data.error ?? "Could not create group.");
      if (data.group) {
        setGroups((prev) =>
          [...prev, data.group!].sort((a, b) => a.name.localeCompare(b.name)),
        );
      }
      toast.success("Staff group created.");
      setModalOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not create group.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(group: StaffGroup) {
    setDeleting(true);
    try {
      const res = await fetch("/api/pulse/staff-groups", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: group.id }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not delete group.");
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      setGroupToDelete(null);
      toast.success("Staff group deleted.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete group.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleUpdateMembers() {
    if (!groupToManage || managingIds.length < 2) return;
    setUpdatingMembers(true);
    try {
      const res = await fetch("/api/pulse/staff-groups", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: groupToManage.id, member_ids: managingIds }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok)
        throw new Error(data.error ?? "Could not update group members.");
      setGroups((prev) =>
        prev.map((group) =>
          group.id === groupToManage.id
            ? { ...group, member_ids: managingIds }
            : group,
        ),
      );
      setGroupToManage(null);
      toast.success("Group members updated.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not update group members.",
      );
    } finally {
      setUpdatingMembers(false);
    }
  }

  return (
    <>
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 dark:shadow-black/20">
        <div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              Staff groups
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              Reusable groups for targeting feedback and campaigns.
            </p>
          </div>
          <Button size="sm" icon="solar:add-circle-broken" onClick={openModal}>
            New group
          </Button>
        </div>

        {groups.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
              <Icon
                icon="solar:users-group-rounded-broken"
                className="h-5 w-5"
              />
            </span>
            <p className="mt-3 text-sm font-semibold text-[var(--text-hi)]">
              No groups yet
            </p>
            <p className="mt-1 text-xs text-[var(--text-lo)]">
              Create a group to send feedback to multiple people at once.
            </p>
          </div>
        ) : (
          <ul className="max-h-[480px] divide-y divide-[var(--border)] overflow-y-auto">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-hi)]">
                    {group.name}
                  </p>
                  <p className="text-xs text-[var(--text-lo)]">
                    {group.member_ids.length} member
                    {group.member_ids.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon="solar:users-group-rounded-broken"
                  onClick={() => openManageModal(group)}
                >
                  Members
                </Button>
                <button
                  type="button"
                  title="Delete group"
                  onClick={() => setGroupToDelete(group)}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
                >
                  <Icon
                    icon="solar:trash-bin-minimalistic-broken"
                    className="h-4 w-4"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Create modal */}
      <SimpleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New staff group"
        icon="solar:users-group-rounded-broken"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Group name
            </label>
            <input
              autoFocus
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Sales Team"
              className={inputCls}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Members{" "}
              <span className="font-normal text-[var(--text-lo)]">
                (select at least 2)
              </span>
            </label>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
              {users.map((user) => {
                const checked = selectedIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-[var(--surface)] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMember(user.id)}
                      className="accent-brand-500"
                    />
                    <span className="text-sm text-[var(--text-hi)]">
                      {user.name}
                    </span>
                  </label>
                );
              })}
            </div>
            {selectedIds.length > 0 && (
              <p className="mt-1.5 text-[10px] text-[var(--text-lo)]">
                {selectedIds.length} member{selectedIds.length !== 1 ? "s" : ""}{" "}
                selected
              </p>
            )}
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>
          <Button
            icon="solar:add-circle-broken"
            loading={saving}
            disabled={saving || !groupName.trim() || selectedIds.length < 2}
            onClick={handleCreate}
          >
            Create group
          </Button>
        </div>
      </SimpleModal>

      {/* Members modal */}
      <SimpleModal
        open={!!groupToManage}
        onClose={() => setGroupToManage(null)}
        title={groupToManage?.name ?? "Group members"}
        icon="solar:users-group-rounded-broken"
        maxWidth="max-w-md"
      >
        <p className="mb-4 text-sm text-[var(--text-lo)]">
          Choose the staff members included in this reusable group.
        </p>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
          {users.map((user) => {
            const checked = managingIds.includes(user.id);
            return (
              <label
                key={user.id}
                className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-[var(--surface)]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleManagedMember(user.id)}
                  className="accent-brand-500"
                />
                <span className="text-sm text-[var(--text-hi)]">
                  {user.name}
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--text-lo)]">
            {managingIds.length} member{managingIds.length !== 1 ? "s" : ""}{" "}
            selected
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setGroupToManage(null)}>
              Cancel
            </Button>
            <Button
              loading={updatingMembers}
              disabled={updatingMembers || managingIds.length < 2}
              onClick={handleUpdateMembers}
            >
              Save members
            </Button>
          </div>
        </div>
      </SimpleModal>

      {/* Delete confirm modal */}
      <SimpleModal
        open={!!groupToDelete}
        onClose={() => setGroupToDelete(null)}
        title="Delete staff group"
        icon="solar:trash-bin-minimalistic-broken"
        maxWidth="max-w-md"
      >
        <p className="text-sm text-[var(--text-lo)]">
          Delete{" "}
          <strong className="text-[var(--text-hi)]">
            {groupToDelete?.name}
          </strong>
          ? This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <Button variant="secondary" onClick={() => setGroupToDelete(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            icon="solar:trash-bin-minimalistic-broken"
            loading={deleting}
            onClick={() => groupToDelete && handleDelete(groupToDelete)}
          >
            Delete group
          </Button>
        </div>
      </SimpleModal>
    </>
  );
}
