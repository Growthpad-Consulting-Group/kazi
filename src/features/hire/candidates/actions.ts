"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  assertHireCandidateAccess,
  getHireCompanyAccess,
} from "@/lib/hire-company-access";
import { invalidateTables } from "@/lib/cache/invalidate";
import { recordHireAuditEvent } from "@/lib/hire-audit";
import { getHireCompanyRecruiterIds } from "@/lib/notifications";
import { deliverSlackNotification } from "@/lib/slack";
import { getCachedCandidates } from "@/lib/cache/queries";
import type { Candidate, CandidateStage } from "@/types/database";

export type CandidateWithJob = Candidate & {
  jobs: {
    title: string;
    department: string | null;
    location: string | null;
    scoring_rubric: {
      criterion: string;
      weight: number;
      description: string;
    }[];
  } | null;
};

export type NoteWithUser = {
  id: string;
  candidate_id: string;
  user_id: string;
  note: string;
  created_at: string;
  users: { name: string } | null;
};

export async function getCandidates(
  jobId?: string,
): Promise<CandidateWithJob[]> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  const companyIds = (
    await getHireCompanyAccess(session.user.id, session.user.role)
  ).map((access) => access.companyId);
  if (companyIds.length === 0) throw new Error("Forbidden");

  return (await getCachedCandidates(
    jobId,
    false,
    companyIds,
  )) as unknown as CandidateWithJob[];
}

export async function getCandidate(id: string): Promise<CandidateWithJob> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  await assertHireCandidateAccess({
    userId: session.user.id,
    userRole: session.user.role,
    candidateId: id,
  });

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("*, jobs(title, department, location, scoring_rubric)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data as unknown as CandidateWithJob;
}

export async function updateCandidateStage(id: string, stage: CandidateStage) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  const access = await assertHireCandidateAccess({
    userId: session.user.id,
    userRole: session.user.role,
    candidateId: id,
    minimumRole: "hiring_manager",
  });

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({ stage, recruiter_activity_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/hire/candidates");
  revalidatePath(`/hire/candidates/${id}`);
  revalidatePath("/hire/pipeline");
  await invalidateTables("candidates");
  await recordHireAuditEvent({
    companyId: access.companyId,
    actorUserId: session.user.id,
    action: "candidate.stage_updated",
    entityType: "candidate",
    entityId: id,
    metadata: { stage },
  });
  if (stage === "hired") {
    const recipients = await getHireCompanyRecruiterIds(access.companyId);
    await Promise.all(
      recipients.map((recipientUserId) =>
        deliverSlackNotification({
          eventKey: `candidate-hired:${id}:${recipientUserId}`,
          recipientUserId,
          category: "candidate_hired",
          critical: true,
          text: "A hired candidate is ready to be added to staff.",
          blocks: [
            {
              type: "header",
              text: { type: "plain_text", text: "New hire ready to onboard" },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "A candidate has been moved to *Hired* and is ready to be added to staff.",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: { type: "plain_text", text: "Add to staff" },
                  url: `${process.env.PRODUCTION_APP_URL ?? "http://localhost:3000"}/hire/candidates/${id}`,
                },
              ],
            },
          ],
        }),
      ),
    );
  }
}

export async function assignCandidate(id: string, userId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  const access = await assertHireCandidateAccess({
    userId: session.user.id,
    userRole: session.user.role,
    candidateId: id,
    minimumRole: "hiring_manager",
  });

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({
      assigned_to: userId,
      recruiter_activity_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/hire/candidates/${id}`);
  await invalidateTables("candidates");
  await recordHireAuditEvent({
    companyId: access.companyId,
    actorUserId: session.user.id,
    action: "candidate.assigned",
    entityType: "candidate",
    entityId: id,
    metadata: { assigneeId: userId },
  });
}

export async function addNote(candidateId: string, note: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  await assertHireCandidateAccess({
    userId: session.user.id,
    userRole: session.user.role,
    candidateId,
  });

  const { error } = await supabaseAdmin.from("candidate_notes").insert({
    candidate_id: candidateId,
    user_id: session.user.id,
    note,
  });

  if (error) throw new Error(error.message);
  await supabaseAdmin
    .from("candidates")
    .update({ recruiter_activity_at: new Date().toISOString() })
    .eq("id", candidateId);
  revalidatePath(`/hire/candidates/${candidateId}`);
  await invalidateTables("candidates");
  await invalidateTables("candidate_notes");
}

export async function getCandidateNotes(
  candidateId: string,
): Promise<NoteWithUser[]> {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  await assertHireCandidateAccess({
    userId: session.user.id,
    userRole: session.user.role,
    candidateId,
  });

  const { data, error } = await supabaseAdmin
    .from("candidate_notes")
    .select("*, users(name)")
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as NoteWithUser[];
}

export async function shortlistCandidate(id: string, shortlisted: boolean) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");
  const access = await assertHireCandidateAccess({
    userId: session.user.id,
    userRole: session.user.role,
    candidateId: id,
    minimumRole: "hiring_manager",
  });

  const { error } = await supabaseAdmin
    .from("candidates")
    .update({ shortlisted, recruiter_activity_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath(`/hire/candidates/${id}`);
  revalidatePath("/hire/candidates");
  await invalidateTables("candidates");
  await recordHireAuditEvent({
    companyId: access.companyId,
    actorUserId: session.user.id,
    action: "candidate.shortlist_updated",
    entityType: "candidate",
    entityId: id,
    metadata: { shortlisted },
  });
}
