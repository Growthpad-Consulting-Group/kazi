import { supabaseAdmin } from "@/lib/supabase";
import { sendSlackDirectMessage } from "@/lib/slack";

export const NEXT_REVIEW_STATUS = {
  pending: "self_review",
  self_review: "manager_review",
  manager_review: "peer_review",
  peer_review: "completed",
} as const;

export const REVIEW_TYPE_STAGE = {
  self: "self_review",
  manager: "manager_review",
  peer: "peer_review",
} as const;

export async function generateCycleReviews(cycleId: string) {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, manager_id")
    .eq("is_active", true);
  const people = (data ?? []) as { id: string; manager_id: string | null }[];
  const activeIds = new Set(people.map((person) => person.id));

  const rows = people.flatMap((person) => {
    const self = {
      cycle_id: cycleId,
      reviewee_id: person.id,
      reviewer_id: person.id,
      review_type: "self" as const,
    };
    const hasManager =
      person.manager_id &&
      person.manager_id !== person.id &&
      activeIds.has(person.manager_id);
    return hasManager
      ? [
          self,
          {
            cycle_id: cycleId,
            reviewee_id: person.id,
            reviewer_id: person.manager_id as string,
            review_type: "manager" as const,
          },
        ]
      : [self];
  });
  if (!rows.length) return;
  await supabaseAdmin.from("performance_reviews").upsert(rows, {
    onConflict: "cycle_id,reviewee_id,reviewer_id,review_type",
    ignoreDuplicates: true,
  });
}

const STAGE_LABEL: Record<string, string> = {
  self_review: "self review",
  manager_review: "manager review",
  peer_review: "peer review",
};

export async function notifyOutstandingReviewers(
  cycleId: string,
  stage: keyof typeof STAGE_LABEL,
  options: {
    cycleTitle: string;
    dueDate: string;
    overdue: boolean;
    opening: boolean;
  },
) {
  const type = (
    Object.keys(REVIEW_TYPE_STAGE) as (keyof typeof REVIEW_TYPE_STAGE)[]
  ).find((key) => REVIEW_TYPE_STAGE[key] === stage);
  if (!type) return 0;

  const { data } = await supabaseAdmin
    .from("performance_reviews")
    .select("reviewer_id")
    .eq("cycle_id", cycleId)
    .eq("review_type", type)
    .is("submitted_at", null);
  const reviewerIds = [
    ...new Set(
      ((data ?? []) as { reviewer_id: string }[]).map((row) => row.reviewer_id),
    ),
  ];
  if (!reviewerIds.length) return 0;

  const { data: people } = await supabaseAdmin
    .from("users")
    .select("id, email")
    .in("id", reviewerIds)
    .eq("is_active", true);
  const label = STAGE_LABEL[stage];
  const due = new Date(`${options.dueDate}T12:00:00`).toLocaleDateString(
    "en-GB",
    { day: "numeric", month: "short" },
  );
  const message = options.opening
    ? `Your ${label} for ${options.cycleTitle} is open. Please complete it by ${due}.`
    : options.overdue
      ? `Your ${label} for ${options.cycleTitle} is overdue (was due ${due}).`
      : `Reminder: your ${label} for ${options.cycleTitle} is due ${due}.`;

  const link = `/pulse/reviews/${cycleId}`;
  await supabaseAdmin
    .from("notifications")
    .insert(reviewerIds.map((userId) => ({ user_id: userId, message, link })));
  for (const person of (people ?? []) as { id: string; email: string }[]) {
    await sendSlackDirectMessage(person.email, message);
  }
  return reviewerIds.length;
}
