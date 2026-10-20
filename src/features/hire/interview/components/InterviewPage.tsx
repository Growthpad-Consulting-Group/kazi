import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { InterviewKit } from "./InterviewKit";

export default async function InterviewPage({ candidateId }: { candidateId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data, error } = await supabaseAdmin
    .from("candidates")
    .select("id, full_name, stage, jobs(id, title, scoring_rubric)")
    .eq("id", candidateId)
    .single();

  if (error || !data) notFound();

  const candidate = data as unknown as {
    id: string;
    full_name: string;
    stage: string;
    jobs: { id: string; title: string; scoring_rubric: { criterion: string; weight: number }[] } | null;
  };

  // Fetch existing scorecards for this interviewer
  const { data: scorecard } = await supabaseAdmin
    .from("interview_scorecards")
    .select("*")
    .eq("candidate_id", candidateId)
    .eq("interviewer_id", session.user.id)
    .maybeSingle();

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <p className="text-sm text-blue-600 font-medium">{candidate.jobs?.title}</p>
        <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
          Interview Kit — {candidate.full_name}
        </h1>
      </div>
      <InterviewKit
        candidateId={candidateId}
        rubric={candidate.jobs?.scoring_rubric ?? []}
        existingScorecard={scorecard}
      />
    </div>
  );
}
