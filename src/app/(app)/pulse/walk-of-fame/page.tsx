import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export default async function WalkOfFameRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  // Legacy destination: recognition rankings now live in Culture leaderboards.
  redirect("/pulse/leaderboards");
}
