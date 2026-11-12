import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import WallOfFameArchive from "@/features/pulse/wall-of-fame/components/WallOfFameArchive";

export default async function WallOfFameArchivePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <WallOfFameArchive />;
}
