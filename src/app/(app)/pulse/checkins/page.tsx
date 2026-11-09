import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import CheckinsPage from "@/features/pulse/checkins/components/CheckinsPage";
import GoalsPage from "@/features/pulse/goals/components/GoalsPage";
import StaffGoalsPage from "@/features/pulse/goals/components/StaffGoalsPage";
import OneOnOnesPage from "@/features/pulse/one-on-ones/components/OneOnOnesPage";
import TabBar from "@/components/ui/TabBar";
import { DailyLogPage } from "@/features/pulse/daily-log/components/DailyLogPage";

export const dynamic = "force-dynamic";

function currentWeekStart() {
  const date = new Date();
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date.toISOString().slice(0, 10);
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    user?: string;
    report?: string;
    view?: string;
    teamView?: string;
    week?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  const isManager = session ? can(session.user.role, "manage_checkins") : false;

  const { tab, user, report, view, teamView, week } = await searchParams;
  if (isManager && !user && tab === "checkins") {
    redirect("/pulse/checkins?view=reflection");
  }
  // Managers have two distinct workflows here: their own work and their
  // team's work. Keep legacy personal check-in links working, but surface
  // them under My work instead of creating another near-identical top tab.
  const personalReflection = isManager && !user && view === "reflection";
  const viewingReportCheckin = isManager && !!user;
  const activeTab = personalReflection
    ? "daily"
    : viewingReportCheckin
      ? "team"
      : (tab ?? "daily");
  const weeklyCheckin =
    session && activeTab === "daily"
      ? await supabaseAdmin
          .from("checkins")
          .select("status")
          .eq("user_id", session.user.id)
          .eq("week_start", currentWeekStart())
          .maybeSingle()
      : { data: null };
  const weeklyCheckinSubmitted =
    weeklyCheckin.data?.status === "submitted" ||
    weeklyCheckin.data?.status === "reviewed";

  const TABS = [
    {
      id: "daily",
      label: isManager ? "My work" : "Daily log",
      icon: "solar:notebook-broken",
      clearParams: isManager ? ["view", "teamView"] : undefined,
    },
    ...(isManager
      ? [
          {
            id: "team",
            label: "Team",
            icon: "solar:users-group-two-rounded-broken",
            clearParams: ["teamView"],
          },
        ]
      : []),
    ...(!isManager
      ? [
          {
            id: "checkins",
            label: "Weekly check-in",
            icon: "solar:checklist-minimalistic-broken",
          },
        ]
      : []),
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
      {activeTab === "team" &&
        (viewingReportCheckin ? (
          <CheckinsPage userId={user} selectedWeekStart={week} />
        ) : teamView === "activity" ? (
          <DailyLogPage isReviewer weeklyCheckinSubmitted={false} />
        ) : (
          <CheckinsPage userId={user} teamOnly />
        ))}
      {activeTab === "daily" &&
        (personalReflection ? (
          <CheckinsPage selectedWeekStart={week} />
        ) : (
          <DailyLogPage
            weeklyCheckinSubmitted={weeklyCheckinSubmitted}
            weeklyCheckinHref={
              isManager
                ? "/pulse/checkins?view=reflection"
                : "/pulse/checkins?tab=checkins"
            }
          />
        ))}
      {(activeTab === "checkins" ||
        !["goals", "one-on-ones", "team", "daily"].includes(activeTab)) && (
        <CheckinsPage userId={user} selectedWeekStart={week} />
      )}
    </div>
  );
}
