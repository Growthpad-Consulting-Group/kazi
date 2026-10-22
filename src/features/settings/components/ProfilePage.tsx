import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  type UserRow = { job_title: string | null; location: string | null; avatar_url: string | null } | null;
  type SigProfileRow = { photo_url: string | null } | null;
  type SignatureDb = { from: (t: string) => { select: (c: string) => { eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown }> } } } };

  const [{ data: user }, sigResult] = await Promise.all([
    supabaseAdmin.from("users").select("job_title, location, avatar_url").eq("id", session.user.id).single(),
    (supabaseAdmin as unknown as SignatureDb)
      .from("signature_staff_profiles")
      .select("photo_url")
      .eq("user_id", session.user.id)
      .maybeSingle(),
  ]);

  const userData = user as UserRow;
  const sigData = sigResult.data as SigProfileRow;
  // Use signature staff photo as fallback when no Kazi avatar is set
  const avatarUrl = userData?.avatar_url ?? sigData?.photo_url ?? null;

  return (
    <div className="space-y-6">
      <SetPageHeader title="Profile" description="Your personal details and access" icon="solar:user-broken" />
      <ProfileClient
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
