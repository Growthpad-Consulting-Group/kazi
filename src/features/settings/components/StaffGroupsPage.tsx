import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { StaffGroupsClient } from "./StaffGroupsClient";
import type { StaffGroup } from "@/types/database";

export default async function StaffGroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !can(session.user.role, "manage_recognition_campaigns")) {
    redirect("/dashboard");
  }

  const [groupsResult, usersResult] = await Promise.all([
    supabaseAdmin.from("staff_groups").select("*").order("name"),
    supabaseAdmin.from("users").select("id, name").eq("is_active", true).order("name"),
  ]);

  const groups = (groupsResult.data ?? []) as StaffGroup[];
  const users = (usersResult.data ?? []) as { id: string; name: string }[];

  return (
    <div className="space-y-6">
      <SetPageHeader
        title="Staff Groups"
        description="Reusable groups for targeting feedback and campaigns"
        icon="solar:users-group-rounded-broken"
      />
      <StaffGroupsClient initial={groups} users={users} />
    </div>
  );
}
