"use client";

import { PasswordInput } from "@/components/ui/PasswordInput";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Icon } from "@iconify/react";
import toast from "react-hot-toast";
import { updateProfile, changePassword } from "../actions";
import SettingsSection from "./SettingsSection";
import { Button } from "@/components/ui/Button";
import AvatarUpload from "@/components/ui/AvatarUpload";

const inputCls =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-2.5 text-sm text-[var(--text-hi)] placeholder:text-[var(--text-lo)] transition-all focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30";

interface Props {
  initial: {
    name: string;
    email: string;
    role: string;
    department: string | null;
    job_title: string | null;
    location: string | null;
    avatar_url: string | null;
  };
  /** True when the person must choose a new password before using the rest of Kazi. */
  passwordRequired?: boolean;
  googleProfileConnected?: boolean;
}

export default function ProfileClient({
  initial,
  passwordRequired = false,
  googleProfileConnected = false,
}: Props) {
  const router = useRouter();
  const { update: updateSession } = useSession();

  // Profile fields
  const [name, setName] = useState(initial.name);
  const [jobTitle, setJobTitle] = useState(initial.job_title ?? "");
  const [location, setLocation] = useState(initial.location ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? "");
  const [isPending, startTransition] = useTransition();

  // Password fields
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwPending, startPwTransition] = useTransition();

  const profileDirty =
    name !== initial.name ||
    jobTitle !== (initial.job_title ?? "") ||
    location !== (initial.location ?? "") ||
    avatarUrl !== (initial.avatar_url ?? "");

  function saveProfile() {
    startTransition(async () => {
      try {
        const saved = await updateProfile({
          name,
          job_title: jobTitle || null,
          location: location || null,
          avatar_url: avatarUrl || null,
        });
        await updateSession({ name: saved.name });
        toast.success("Profile updated");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save profile");
      }
    });
  }

  function savePassword() {
    if (newPw !== confirmPw) {
      toast.error("Passwords do not match");
      return;
    }
    startPwTransition(async () => {
      try {
        await changePassword({ current: currentPw, next: newPw });
        toast.success("Password changed");
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
        if (passwordRequired) {
          // The temporary password is replaced, so take them into the app.
          router.replace("/dashboard");
          router.refresh();
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not change password",
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Avatar + identity */}
      <SettingsSection
        title="Your details"
        description="How you appear across Kazi"
        icon="solar:user-id-broken"
      >
        <div className="pb-5 border-b border-[var(--border)]">
          <AvatarUpload
            value={avatarUrl}
            name={name || "U"}
            uploadEndpoint="/api/users/avatar"
            onChange={(url) => {
              setAvatarUrl(url);
            }}
            size="lg"
          />
          <p className="mt-2 text-xs text-[var(--text-lo)]">
            Or paste a URL below. Shown in the top bar and your profile.
          </p>
        </div>

        <div className="pt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Full name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Email
            </span>
            <input
              type="email"
              value={initial.email}
              readOnly
              aria-readonly="true"
              className={inputCls + " cursor-not-allowed opacity-70"}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Job title
            </span>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="e.g. Product Designer"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Location
            </span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Nairobi, Kenya"
              className={inputCls}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Avatar URL
            </span>
            <input
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
              className={inputCls}
            />
          </label>
        </div>
        <p className="mt-3 text-xs text-[var(--text-lo)]">
          Your email is your fixed sign-in address. Contact an administrator if
          it needs to change.
        </p>

        <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
          <Button
            icon="solar:diskette-broken"
            loading={isPending}
            disabled={!profileDirty}
            onClick={saveProfile}
          >
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Work profile"
        description="Refresh your name and photo from your Growthpad work account."
        icon="solar:case-minimalistic-broken"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[var(--text-lo)]">
            {googleProfileConnected
              ? "Connected through Google. Refresh any time to use your current profile photo."
              : "Google verifies your work email and shares only your basic profile details."}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                router.push("/api/integrations/google-profile/connect");
              }}
            >
              {googleProfileConnected
                ? "Refresh work profile"
                : "Connect work profile"}
            </Button>
            {googleProfileConnected && (
              <Button
                variant="secondary"
                onClick={async () => {
                  const response = await fetch(
                    "/api/integrations/google-profile/disconnect",
                    { method: "DELETE" },
                  );
                  if (response.ok) {
                    toast.success("Google profile disconnected");
                    router.refresh();
                  } else toast.error("Could not disconnect Google profile");
                }}
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </SettingsSection>

      {/* Read-only access info */}
      <SettingsSection
        title="Access"
        description="Managed by your administrator"
        icon="solar:shield-check-broken"
      >
        <div className="divide-y divide-[var(--border)]">
          {[
            { label: "Role", value: initial.role.replace("_", " ") },
            { label: "Department", value: initial.department ?? "—" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <span className="text-xs text-[var(--text-lo)]">{label}</span>
              <span className="text-sm font-medium capitalize text-[var(--text-hi)]">
                {value}
              </span>
            </div>
          ))}
        </div>
      </SettingsSection>

      {/* Password change */}
      <SettingsSection
        title="Password"
        description="Change your sign-in password"
        icon="solar:lock-password-broken"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Current password
            </span>
            <PasswordInput
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              autoComplete="current-password"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              New password
            </span>
            <PasswordInput
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-[var(--text-hi)]">
              Confirm new password
            </span>
            <PasswordInput
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
              className={inputCls}
            />
          </label>
        </div>
        {newPw && confirmPw && newPw !== confirmPw && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
            <Icon icon="solar:danger-triangle-broken" className="h-3.5 w-3.5" />{" "}
            Passwords do not match
          </p>
        )}
        <div className="mt-5 flex justify-end border-t border-[var(--border)] pt-4">
          <Button
            icon="solar:lock-password-broken"
            loading={pwPending}
            disabled={!currentPw || !newPw || !confirmPw || newPw !== confirmPw}
            onClick={savePassword}
          >
            {pwPending ? "Changing…" : "Change password"}
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
