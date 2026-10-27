"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/Button";
import { SimpleModal } from "@/components/ui/SimpleModal";

const CHARSET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A readable 12-character temporary password. */
function generatePassword() {
  const values = crypto.getRandomValues(new Uint32Array(12));
  return Array.from(values, (value) => CHARSET[value % CHARSET.length]).join("");
}

/** Admin and HR can give an existing person a temporary password. They must change it at their next sign-in. */
export function ResetPasswordButton({ userId, userName }: { userId: string; userName: string }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    setOpen(false);
    setPassword("");
  };

  const reset = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/staff/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not reset the password.");
      toast.success(`Temporary password set. Share it with ${userName} — they must change it when they sign in.`);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not reset the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="secondary" icon="solar:key-broken" onClick={() => { setPassword(generatePassword()); setOpen(true); }}>
        Reset password
      </Button>
      <SimpleModal open={open} onClose={close} title={`Reset password for ${userName}`} icon="solar:key-broken" maxWidth="max-w-md">
        <div className="space-y-4">
          <p className="text-xs text-[var(--text-lo)]">
            Give them this temporary password. They will be asked to choose a new one when they next sign in.
          </p>
          <div className="space-y-1.5">
            <label htmlFor="temp-password" className="block text-xs font-medium text-[var(--text-hi)]">Temporary password</label>
            <div className="flex items-center gap-2">
              <input
                id="temp-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm text-[var(--text-hi)] outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <Button size="sm" variant="secondary" icon="solar:refresh-broken" onClick={() => setPassword(generatePassword())}>New</Button>
            </div>
            <p className="text-[11px] text-[var(--text-lo)]">At least 8 characters.</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button variant="secondary" onClick={close}>Cancel</Button>
            <Button loading={saving} disabled={password.length < 8} onClick={reset}>Set temporary password</Button>
          </div>
        </div>
      </SimpleModal>
    </>
  );
}
