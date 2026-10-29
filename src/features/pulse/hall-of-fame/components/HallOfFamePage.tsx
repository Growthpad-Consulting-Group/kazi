import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import HallOfFameClient from "./HallOfFameClient";

type Cycle = {
  id: string;
  month: string;
  status: "draft" | "open" | "closed";
  opens_at: string | null;
  closes_at: string | null;
};
type Staff = {
  id: string;
  name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: string | null;
};
type Nomination = {
  id: string;
  nominator_id: string;
  nominee_id: string;
  category: "wow" | "mvp";
  impact_statement: string;
  created_at: string;
};

export default async function HallOfFamePage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table; generated database types lag migrations
  const db = supabaseAdmin as any;
  const { data: cycleData } = await db
    .from("hall_of_fame_cycles")
    .select("id, month, status, opens_at, closes_at")
    .in("status", ["open", "closed"])
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cycle = cycleData as Cycle | null;
  const [{ data: staffData }, { data: signatureProfiles }, nominationsResult] =
    await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id, name, job_title, department, avatar_url")
        .eq("is_active", true)
        .not("role", "in", "(admin,hr,manager)")
        .order("name"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped signature table
      (supabaseAdmin as any)
        .from("signature_staff_profiles")
        .select("user_id, photo_url")
        .not("photo_url", "is", null),
      cycle
        ? db
            .from("hall_of_fame_nominations")
            .select(
              "id, nominator_id, nominee_id, category, impact_statement, created_at",
            )
            .eq("cycle_id", cycle.id)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);
  const signaturePhotos = new Map(
    (
      (signatureProfiles ?? []) as {
        user_id: string | null;
        photo_url: string | null;
      }[]
    )
      .filter((p) => p.user_id && p.photo_url)
      .map((p) => [p.user_id as string, p.photo_url as string]),
  );
  return (
    <>
      <HallOfFameClient
        currentUserId={session.user.id}
        canManage={userCan(session.user, "manage_recognition_campaigns")}
        cycle={cycle}
        staff={((staffData ?? []) as Staff[]).map((member) => ({
          ...member,
          avatar_url:
            member.avatar_url ?? signaturePhotos.get(member.id) ?? null,
        }))}
        nominations={(nominationsResult.data ?? []) as Nomination[]}
      />
    </>
  );
}
