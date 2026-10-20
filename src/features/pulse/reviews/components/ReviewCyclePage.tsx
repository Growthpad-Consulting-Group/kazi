import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import { ReviewForm } from "./ReviewForm";
import type { ReviewCycleRow, PerformanceReview, ReviewType } from "@/types/database";

type UserRow = { id: string; name: string; job_title: string | null };

export default async function ReviewCyclePage({ cycleId }: { cycleId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data: cycleData } = await supabaseAdmin.from("review_cycles").select("*").eq("id", cycleId).single();
  if (!cycleData) notFound();
  const cycle = cycleData as unknown as ReviewCycleRow;

  const isAdmin = hasRole(session.user.role, "hr");

  // Get all reviews in this cycle
  const { data: reviewsData } = await supabaseAdmin
    .from("performance_reviews")
    .select("*")
    .eq("cycle_id", cycleId);
  const reviews = (reviewsData ?? []) as unknown as PerformanceReview[];

  // My reviews to complete
  const myReviews = reviews.filter((r) => r.reviewer_id === session.user.id && !r.submitted_at);
  const completedByMe = reviews.filter((r) => r.reviewer_id === session.user.id && r.submitted_at);

  // Get user names for reviewees
  const revieweeIds = [...new Set(reviews.map((r) => r.reviewee_id))];
  const { data: usersData } = await supabaseAdmin.from("users").select("id, name, job_title").in("id", revieweeIds);
  const users: Record<string, UserRow> = Object.fromEntries(
    ((usersData ?? []) as unknown as UserRow[]).map((u) => [u.id, u])
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{cycle.title}</h1>
        <p className="mt-1 text-sm text-slate-500 capitalize">
          {cycle.cycle} · {new Date(cycle.start_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })} – {new Date(cycle.end_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      {/* Reviews I need to complete */}
      {myReviews.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Awaiting Your Input ({myReviews.length})</h2>
          {myReviews.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{users[r.reviewee_id]?.name ?? "—"}</p>
                  <p className="text-xs text-slate-400 capitalize">{r.review_type} review · {users[r.reviewee_id]?.job_title ?? ""}</p>
                </div>
              </div>
              <ReviewForm review={r} cycleId={cycleId} revieweeId={r.reviewee_id} reviewType={r.review_type as ReviewType} />
            </div>
          ))}
        </div>
      )}

      {/* Completed reviews */}
      {completedByMe.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Completed ({completedByMe.length})</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
            {completedByMe.map((r, i) => (
              <div key={r.id} className={`flex items-center justify-between px-5 py-3 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <div>
                  <p className="text-sm font-medium text-slate-900">{users[r.reviewee_id]?.name ?? "—"}</p>
                  <p className="text-xs text-slate-400 capitalize">{r.review_type} review</p>
                </div>
                <div className="flex items-center gap-3">
                  {r.overall_rating && (
                    <span className="text-sm font-semibold text-slate-700">{r.overall_rating}/5</span>
                  )}
                  <span className="rounded-full bg-green-100 text-green-700 px-2.5 py-0.5 text-xs font-medium">Submitted</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {myReviews.length === 0 && completedByMe.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="text-sm text-slate-400">No reviews assigned to you in this cycle.</p>
          {isAdmin && <p className="text-xs text-slate-400 mt-1">Assign reviews from the admin panel.</p>}
        </div>
      )}
    </div>
  );
}
