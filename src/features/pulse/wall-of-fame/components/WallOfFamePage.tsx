import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { userCan } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { localClock } from "@/lib/slack-schedule";
import { resolveWallOfFameStage } from "@/lib/wall-of-fame-stage";
import WallOfFameClient from "./WallOfFameClient";
import { loadWallOfFameCategories } from "@/lib/wall-of-fame-categories";

type Cycle = {
  id: string;
  month: string;
  status:
    | "draft"
    | "open"
    | "team_voting"
    | "management_voting"
    | "published"
    | "closed";
  opens_at: string | null;
  closes_at: string | null;
  team_voting_opens_at: string | null;
  team_voting_closes_at: string | null;
  management_voting_opens_at: string | null;
  management_voting_closes_at: string | null;
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
  nominator_id: string | null;
  nominee_id: string;
  category: string;
  impact_statement: string | null;
  public_highlight: string | null;
  created_at: string;
};
type StoredNomination = Omit<
  Nomination,
  "nominator_id" | "impact_statement"
> & {
  nominator_id: string;
  impact_statement: string;
};
type Vote = {
  nominee_id: string;
  voter_id: string;
  category: string;
  score: number;
  stage: "team" | "management";
};
type Winner = {
  id: string;
  nominee_id: string;
  category: string;
  team_score: number | null;
  management_score: number | null;
  prize_status: "pending" | "ordered" | "delivered";
};

export default async function WallOfFamePage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const canManage = userCan(session.user, "manage_recognition_campaigns");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed table; generated database types lag migrations
  const db = supabaseAdmin as any;
  const { data: cycleData } = await db
    .from("wall_of_fame_cycles")
    .select(
      "id, month, status, opens_at, closes_at, team_voting_opens_at, team_voting_closes_at, management_voting_opens_at, management_voting_closes_at",
    )
    .in("status", [
      "open",
      "team_voting",
      "management_voting",
      "published",
      "closed",
    ])
    .order("month", { ascending: false })
    .limit(1)
    .maybeSingle();
  const storedCycle = cycleData as Cycle | null;
  // The stage follows the dates, so the page never shows a stage that has already passed.
  const cycle = storedCycle
    ? {
        ...storedCycle,
        status: resolveWallOfFameStage(
          storedCycle,
          localClock(new Date(), "Africa/Nairobi").date,
        ),
      }
    : null;
  const [
    { data: staffData },
    { data: signatureProfiles },
    nominationsResult,
    votesResult,
    winnersResult,
  ] = await Promise.all([
    supabaseAdmin
      .from("users")
      .select("id, name, job_title, department, avatar_url")
      .eq("is_active", true)
      .not("role", "in", "(admin,hr)")
      .order("name"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped signature table
    (supabaseAdmin as any)
      .from("signature_staff_profiles")
      .select("user_id, photo_url")
      .not("photo_url", "is", null),
    cycle
      ? db
          .from("wall_of_fame_nominations")
          .select(
            "id, nominator_id, nominee_id, category, impact_statement, public_highlight, created_at",
          )
          .eq("cycle_id", cycle.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    cycle
      ? db
          .from("wall_of_fame_votes")
          .select("nominee_id, voter_id, category, score, stage")
          .eq("cycle_id", cycle.id)
          .eq("stage", "team")
      : Promise.resolve({ data: [] }),
    cycle
      ? db
          .from("wall_of_fame_winners")
          .select(
            "id, nominee_id, category, team_score, management_score, prize_status",
          )
          .eq("cycle_id", cycle.id)
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
  const categories = await loadWallOfFameCategories();
  // Nomination source text is sensitive peer feedback. Do not send another
  // staff member's words (or identity) to the browser just to render a count.
  // Reviewers and the original nominator retain access to the full record.
  const nominations = (
    (nominationsResult.data ?? []) as StoredNomination[]
  ).map((nomination) => {
    const canReadSource =
      canManage || nomination.nominator_id === session.user.id;
    return {
      ...nomination,
      nominator_id: canReadSource ? nomination.nominator_id : null,
      impact_statement: canReadSource ? nomination.impact_statement : null,
    };
  });
  return (
    <>
      <div className="mb-4 flex justify-end gap-4">
        <Link
          href="/pulse/wall-of-fame/archive"
          className="text-xs font-semibold text-brand-500 hover:underline"
        >
          Past winners
        </Link>
        {canManage && (
          <Link
            href="/pulse/wall-of-fame/categories"
            className="text-xs font-semibold text-brand-500 hover:underline"
          >
            Manage categories
          </Link>
        )}
      </div>
      <WallOfFameClient
        categories={categories}
        currentUserId={session.user.id}
        canManage={canManage}
        canTeamVote={!["admin", "hr"].includes(session.user.role)}
        requiresMonthlyEntry={!["admin", "hr"].includes(session.user.role)}
        cycle={cycle}
        staff={((staffData ?? []) as Staff[]).map((member) => ({
          ...member,
          avatar_url:
            member.avatar_url ?? signaturePhotos.get(member.id) ?? null,
        }))}
        nominations={nominations}
        votes={((votesResult.data ?? []) as Vote[]).filter(
          (vote) => canManage || vote.voter_id === session.user.id,
        )}
        winners={(winnersResult.data ?? []) as Winner[]}
      />
    </>
  );
}
