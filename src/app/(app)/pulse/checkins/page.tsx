import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import CheckinsPage from "@/features/pulse/checkins/components/CheckinsPage";
import GoalsPage from "@/features/pulse/goals/components/GoalsPage";
import StaffGoalsPage from "@/features/pulse/goals/components/StaffGoalsPage";
import OneOnOnesPage from "@/features/pulse/one-on-ones/components/OneOnOnesPage";
import TabBar from "@/components/ui/TabBar";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; user?: string; report?: string; view?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const isManager = session ? can(session.user.role, "manage_checkins") : false;

  const { tab, user, report, view } = await searchParams;
  // Managers default to the team view; employees default to their own check-in
  const activeTab = tab ?? (user ? "checkins" : isManager ? "team" : "checkins");

  const TABS = [
    ...(isManager ? [{ id: "team", label: "Team", icon: "solar:users-group-two-rounded-broken" }] : []),
    { id: "checkins",    label: isManager ? "My check-in" : "Check-ins",  icon: "solar:checklist-minimalistic-broken" },
    { id: "goals",       label: "Goals",      icon: "solar:target-broken" },
    { id: "one-on-ones", label: "1-on-1s",    icon: "solar:chat-round-dots-broken" },
  ];

  return (
    <div>
      <Suspense>
        <TabBar tabs={TABS} />
      </Suspense>

      {activeTab === "goals"       && (user ? <StaffGoalsPage userId={user} /> : <GoalsPage />)}
      {activeTab === "one-on-ones" && <OneOnOnesPage reportId={report} view={view === "upcoming" ? "upcoming" : undefined} />}
      {activeTab === "team"        && <CheckinsPage userId={user} teamOnly />}
      {(activeTab === "checkins" || !["goals", "one-on-ones", "team"].includes(activeTab)) && (
        <CheckinsPage userId={user} />
      )}
    </div>
  );
}
