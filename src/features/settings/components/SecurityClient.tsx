"use client";

import { PasswordInput } from "@/components/ui/PasswordInput";

import { useState, useTransition } from "react";
import { signOut } from "next-auth/react";
import toast from "react-hot-toast";
import { changePassword } from "../actions";
import SettingsSection from "./SettingsSection";
import { Button } from "@/components/ui/Button";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

export default function SecurityClient() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    if (next !== confirm) {
      toast.error("New passwords do not match");
      return;
    }
    startTransition(async () => {
      try {
        await changePassword({ current, next });
        setCurrent("");
        setNext("");
        setConfirm("");
        toast.success("Password updated");
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not change password",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Change password"
        description="At least 8 characters"
        icon="solar:key-broken"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Current password
            </span>
            <PasswordInput
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className={inputCls}
              autoComplete="current-password"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              New password
            </span>
            <PasswordInput
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className={inputCls}
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Confirm new password
            </span>
            <PasswordInput
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
              autoComplete="new-password"
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <Button
            icon="solar:key-broken"
            loading={isPending}
            disabled={!current || !next || !confirm}
            onClick={save}
          >
            {isPending ? "Updating" : "Update password"}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Sessions"
        description="Sign out everywhere if you suspect unauthorised access"
        icon="solar:shield-keyhole-broken"
        iconBg="bg-red-500/10 text-red-500"
      >
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-[var(--text-lo)]">
            You are signed in on this device. Signing out ends your session
            immediately.
          </p>
          <Button
            variant="danger"
            icon="solar:logout-2-broken"
            className="shrink-0"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            Sign out
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
