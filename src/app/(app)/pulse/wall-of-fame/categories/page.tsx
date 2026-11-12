import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { loadWallOfFameCategories } from "@/lib/wall-of-fame-categories";
import WallOfFameCategoriesAdmin from "@/features/pulse/wall-of-fame/components/WallOfFameCategoriesAdmin";

export default async function WallOfFameCategoriesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!userCan(session.user, "manage_recognition_campaigns"))
    redirect("/pulse/wall-of-fame");
  const categories = await loadWallOfFameCategories({ includeRetired: true });
  return <WallOfFameCategoriesAdmin initial={categories} />;
}
