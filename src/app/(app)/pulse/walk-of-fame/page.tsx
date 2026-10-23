import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import WalkOfFamePage from "@/features/pulse/walk-of-fame/components/WalkOfFamePage";

export default async function WalkOfFameRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <WalkOfFamePage />;
}
