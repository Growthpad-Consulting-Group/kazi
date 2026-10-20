"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import toast from "react-hot-toast";
import { updateProfile } from "../actions";
import SettingsSection from "./SettingsSection";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-[#f05d23] focus:ring-2 focus:ring-[#f05d23]/30";

interface Props {
  initial: { name: string; email: string; role: string; department: string | null };
}

export default function ProfileClient({ initial }: Props) {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [name, setName] = useState(initial.name);
  const [email, setEmail] = useState(initial.email);
  const [isPending, startTransition] = useTransition();

  const dirty = name !== initial.name || email !== initial.email;

  function save() {
    startTransition(async () => {
      try {
        const saved = await updateProfile({ name, email });
        // Refresh the auth token — it still holds the previous name/email,
        // which would overwrite the saved values on the next session fetch.
        await updateSession({ name: saved.name, email: saved.email });
        toast.success("Profile updated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save profile");
      }
    });
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title="Your details"
        description="How you appear across Kazi"
        icon="solar:user-id-broken"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Full name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
          </label>
        </div>
        <p className="mt-4 text-xs text-[var(--text-lo)]">
          Your email is also your sign-in address — changing it changes how you sign in.
        </p>
      </SettingsSection>

      <SettingsSection title="Access" description="Managed by your administrator" icon="solar:shield-check-broken">
        <div className="divide-y divide-[var(--border)]">
          {[
            { label: "Role", value: initial.role.replace("_", " ") },
            { label: "Department", value: initial.department ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
              <span className="text-xs text-[var(--text-lo)]">{label}</span>
              <span className="text-sm font-medium capitalize text-[var(--text-hi)]">{value}</span>
            </div>
          ))}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={!dirty || isPending}
          className="rounded-xl bg-gradient-to-r from-[#f05d23] to-[#d94f1e] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
