import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import HallOfFameClient from "./HallOfFameClient";

type Cycle = { id: string; month: string; status: "draft" | "open" | "closed"; opens_at: string | null; closes_at: string | null };
type Staff = { id: string; name: string; job_title: string | null; department: string | null; avatar_url: string | null };
type Nomination = { id: string; nominator_id: string; nominee_id: string; impact_statement: string; created_at: string };

export default async function HallOfFamePage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table; generated database types lag migrations
  const db = supabaseAdmin as any;
  const { data: cycleData } = await db.from("hall_of_fame_cycles").select("id, month, status, opens_at, closes_at").in("status", ["open", "closed"]).order("month", { ascending: false }).limit(1).maybeSingle();
  const cycle = cycleData as Cycle | null;
  const [{ data: staffData }, nominationsResult] = await Promise.all([
    supabaseAdmin.from("users").select("id, name, job_title, department, avatar_url").eq("is_active", true).order("name"),
    cycle ? db.from("hall_of_fame_nominations").select("id, nominator_id, nominee_id, impact_statement, created_at").eq("cycle_id", cycle.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  return <><SetPageHeader title="Growthpad Hall of Fame" description="Celebrate and recognise excellence in work across Growthpad." icon="solar:cup-star-broken" /><HallOfFameClient currentUserId={session.user.id} canManage={can(session.user.role, "manage_recognition_campaigns")} cycle={cycle} staff={(staffData ?? []) as Staff[]} nominations={(nominationsResult.data ?? []) as Nomination[]} /></>;
}
