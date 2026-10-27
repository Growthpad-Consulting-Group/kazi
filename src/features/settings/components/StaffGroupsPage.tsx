import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isPathAllowed } from "@/lib/page-access";
import { can, userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { StaffGroupsClient } from "./StaffGroupsClient";
import { EditableArea, ViewOnlyNotice } from "./EditableArea";
import type { StaffGroup } from "@/types/database";

export default async function StaffGroupsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !isPathAllowed(session.user.allowedPaths, "/settings/staff-groups")) {
    redirect("/settings/profile");
  }
  const canEdit = userCan(session.user, "manage_recognition_campaigns");

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
      {!canEdit && <ViewOnlyNotice permissionLabel="campaign management" />}
      <EditableArea canEdit={canEdit}>
        <StaffGroupsClient initial={groups} users={users} />
      </EditableArea>
    </div>
  );
}
