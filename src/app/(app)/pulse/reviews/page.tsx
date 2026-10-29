import { Suspense } from "react";
import ReviewsPage from "@/features/pulse/reviews/components/ReviewsPage";
import IdpsPage from "@/features/pulse/idps/components/IdpsPage";
import PipsPage from "@/features/pulse/pips/components/PipsPage";
import TabBar from "@/components/ui/TabBar";

const TABS = [
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

  return (
    <div>
      <Suspense>
        <TabBar tabs={TABS} />
      </Suspense>

      {tab === "idps" && <IdpsPage />}
      {tab === "pips" && <PipsPage />}
      {(tab === "reviews" || !["idps", "pips"].includes(tab)) && (
        <ReviewsPage />
      )}
    </div>
  );
}
