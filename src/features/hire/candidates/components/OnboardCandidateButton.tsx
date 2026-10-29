"use client";

import { PasswordInput } from "@/components/ui/PasswordInput";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { SimpleModal } from "@/components/ui/SimpleModal";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";

type Manager = { id: string; name: string; job_title: string | null };

export default function OnboardCandidateButton({
  candidateId,
  candidateName,
  email,
  roleTitle,
  department,
  managers,
}: {
  candidateId: string;
  candidateName: string;
  email: string;
  roleTitle: string | null;
  department: string | null;
  managers: Manager[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [managerId, setManagerId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/hire/candidates/${candidateId}/onboard`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password, managerId, startDate }),
        },
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (body.userId) {
          router.push(`/staff/${body.userId}`);
          return;
        }
        throw new Error(body.error ?? "Could not create the staff record.");
      }
      toast.success(`${candidateName} is now a Kazi staff member`);
      setOpen(false);
      router.push(`/staff/${body.person.id}`);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not create the staff record.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Button icon="solar:user-plus-broken" onClick={() => setOpen(true)}>
        Create staff record
      </Button>
      <SimpleModal
        open={open}
        onClose={() => !saving && setOpen(false)}
        title="Create staff record"
        icon="solar:user-plus-broken"
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="rounded-xl bg-[var(--surface-2)] p-3 text-sm">
            <p className="font-semibold text-[var(--text-hi)]">
              {candidateName}
            </p>
            <p className="mt-0.5 text-[var(--text-lo)]">
              {email} · {roleTitle ?? "Role to be confirmed"}
              {department ? ` · ${department}` : ""}
            </p>
          </div>
          <p className="text-sm leading-6 text-[var(--text-lo)]">
            This creates the employee account, records the hiring handoff and
            adds a signature identity when the email uses a configured company
            domain. Gmail deployment stays pending for review.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Temporary password
              <PasswordInput
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand-500"
              />
            </label>
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Manager
              <select
                value={managerId}
                onChange={(event) => setManagerId(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand-500"
              >
                <option value="">Assign later</option>
                {managers.map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                    {manager.job_title ? ` · ${manager.job_title}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[var(--text-hi)]">
              Start date
              <DatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Choose start date"
              />
            </label>
          </div>
          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              icon="solar:user-plus-broken"
              loading={saving}
              disabled={password.length < 8}
              onClick={submit}
            >
              {saving ? "Creating…" : "Create staff record"}
            </Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
