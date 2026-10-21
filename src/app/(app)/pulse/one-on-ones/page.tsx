import { redirect } from "next/navigation";

export default async function Page({ searchParams }: { searchParams: Promise<{ report?: string }> }) {
  const { report } = await searchParams;
  redirect(`/pulse/checkins?tab=one-on-ones${report ? `&report=${encodeURIComponent(report)}` : ""}`);
}
