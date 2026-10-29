import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { Icon } from "@iconify/react";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { Suspense } from "react";
import ProfileClient from "./ProfileClient";
import { PasswordChangeNotice } from "./PasswordChangeNotice";
import { mustChangePassword } from "@/lib/must-change-password";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  type UserRow = {
    job_title: string | null;
    location: string | null;
    avatar_url: string | null;
  } | null;
  type SigProfileRow = { photo_url: string | null } | null;
  type SignatureDb = {
    from: (t: string) => {
      select: (c: string) => {
        eq: (
          col: string,
          val: string,
        ) => { maybeSingle: () => Promise<{ data: unknown }> };
      };
    };
  };

  const [{ data: user }, sigResult] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("job_title, location, avatar_url")
      .eq("id", session.user.id)
      .single(),
    (supabaseAdmin as unknown as SignatureDb)
      .from("signature_staff_profiles")
      .select("photo_url")
      .eq("user_id", session.user.id)
      .maybeSingle(),
  ]);

  const passwordRequired = await mustChangePassword(session.user.id);
  const userData = user as UserRow;
  const sigData = sigResult.data as SigProfileRow;
  // Use signature staff photo as fallback when no Kazi avatar is set
  const avatarUrl = userData?.avatar_url ?? sigData?.photo_url ?? null;

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Profile"
        description="Your personal details and access"
        icon="solar:user-broken"
      />
      <Suspense fallback={null}>
        <PasswordChangeNotice />
      </Suspense>
      {passwordRequired && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
            <Icon icon="solar:key-broken" className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--text-hi)]">
              Choose a new password to continue
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-lo)]">
              You signed in with a temporary password. Set your own below before
              you use the rest of Kazi.
            </p>
          </div>
        </div>
      )}
      <ProfileClient
        passwordRequired={passwordRequired}
        initial={{
          name: session.user.name ?? "",
          email: session.user.email ?? "",
          role: session.user.role,
          department: session.user.department,
          job_title: userData?.job_title ?? null,
          location: userData?.location ?? null,
          avatar_url: avatarUrl,
        }}
      />
    </div>
  );
}
