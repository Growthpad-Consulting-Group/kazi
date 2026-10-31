import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import ReviewsPage from "@/features/pulse/reviews/components/ReviewsPage";
import IdpsPage from "@/features/pulse/idps/components/IdpsPage";
import PipsPage from "@/features/pulse/pips/components/PipsPage";
import TabBar from "@/components/ui/TabBar";

const MANAGEMENT_TABS = [
  { id: "reviews", label: "Reviews", icon: "solar:clipboard-list-broken" },
  { id: "idps", label: "Dev Plans", icon: "solar:book-broken" },
  { id: "pips", label: "PIPs", icon: "solar:danger-triangle-broken" },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "reviews" } = await searchParams;
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const isEmployee = session.user.role === "employee";
  const { count: pipCount } = isEmployee
    ? await supabaseAdmin
        .from("pips")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
    : { count: 0 };
  const tabs = isEmployee
    ? [
        {
          id: "reviews",
          label: "My reviews",
          icon: "solar:clipboard-list-broken",
        },
        { id: "idps", label: "Development plan", icon: "solar:book-broken" },
        ...(pipCount
          ? [
              {
                id: "pips",
                label: "Support plan",
                icon: "solar:heart-pulse-broken",
              },
            ]
          : []),
      ]
    : MANAGEMENT_TABS;

  return (
    <div>
      <Suspense>
        <TabBar tabs={tabs} />
      </Suspense>

      {tab === "idps" && <IdpsPage />}
      {tab === "pips" && (!isEmployee || (pipCount ?? 0) > 0) && <PipsPage />}
      {(tab === "reviews" || !tabs.some((item) => item.id === tab)) && (
        <ReviewsPage />
      )}
    </div>
  );
}
