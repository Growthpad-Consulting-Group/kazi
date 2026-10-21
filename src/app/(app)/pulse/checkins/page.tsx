import { Suspense } from "react";
import CheckinsPage from "@/features/pulse/checkins/components/CheckinsPage";
import GoalsPage from "@/features/pulse/goals/components/GoalsPage";
import OneOnOnesPage from "@/features/pulse/one-on-ones/components/OneOnOnesPage";
import TabBar from "@/components/ui/TabBar";

const TABS = [
  { id: "checkins",    label: "Check-ins",  icon: "solar:checklist-minimalistic-broken" },
  { id: "goals",       label: "Goals",      icon: "solar:target-broken" },
  { id: "one-on-ones", label: "1-on-1s",    icon: "solar:chat-round-dots-broken" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; user?: string; report?: string }>;
}) {
  const { tab = "checkins", user, report } = await searchParams;

  return (
    <div>
      <Suspense>
        <TabBar tabs={TABS} />
      </Suspense>

      {tab === "goals"       && <GoalsPage />}
      {tab === "one-on-ones" && <OneOnOnesPage reportId={report} />}
      {(tab === "checkins" || !["goals", "one-on-ones"].includes(tab)) && (
        <CheckinsPage userId={user} />
      )}
    </div>
  );
}
