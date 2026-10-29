import { redirect } from "next/navigation";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ report?: string; view?: string }>;
}) {
  const { report, view } = await searchParams;
  const params = new URLSearchParams({ tab: "one-on-ones" });
  if (report) params.set("report", report);
  if (view === "upcoming") params.set("view", "upcoming");
  redirect(`/pulse/checkins?${params.toString()}`);
}
