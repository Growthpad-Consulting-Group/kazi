import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import CheckinsPage from "@/features/pulse/checkins/components/CheckinsPage";
import GoalsPage from "@/features/pulse/goals/components/GoalsPage";
import StaffGoalsPage from "@/features/pulse/goals/components/StaffGoalsPage";
import OneOnOnesPage from "@/features/pulse/one-on-ones/components/OneOnOnesPage";
import TabBar from "@/components/ui/TabBar";
import { DailyLogPage } from "@/features/pulse/daily-log/components/DailyLogPage";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    user?: string;
    report?: string;
    view?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  const isManager = session ? can(session.user.role, "manage_checkins") : false;

  const { tab, user, report, view } = await searchParams;
  const activeTab = tab ?? (user ? "checkins" : isManager ? "team" : "daily");

  const TABS = [
    { id: "daily", label: "Daily log", icon: "solar:notebook-broken" },
    ...(isManager
      ? [
          {
            id: "team",
            label: "Weekly check-ins",
            icon: "solar:users-group-two-rounded-broken",
          },
        ]
      : []),
    ...(isManager
      ? []
      : [
          {
            id: "checkins",
            label: "Weekly check-in",
            icon: "solar:checklist-minimalistic-broken",
          },
        ]),
    { id: "goals", label: "Goals", icon: "solar:target-broken" },
    {
      id: "one-on-ones",
      label: "1-on-1s",
      icon: "solar:chat-round-dots-broken",
    },
  ];

  return (
    <div>
      <Suspense>
        <TabBar tabs={TABS} />
      </Suspense>

      {activeTab === "goals" &&
        (user ? <StaffGoalsPage userId={user} /> : <GoalsPage />)}
      {activeTab === "one-on-ones" && (
        <OneOnOnesPage
          reportId={report}
          view={view === "upcoming" ? "upcoming" : undefined}
        />
      )}
      {activeTab === "team" && <CheckinsPage userId={user} teamOnly />}
      {activeTab === "daily" && <DailyLogPage isReviewer={isManager} />}
      {(activeTab === "checkins" ||
        !["goals", "one-on-ones", "team", "daily"].includes(activeTab)) && (
        <CheckinsPage userId={user} />
      )}
    </div>
  );
}
