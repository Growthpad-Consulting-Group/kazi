import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";
import { NewCycleButton } from "./NewCycleButton";
import type { ReviewCycleRow, ReviewStatus } from "@/types/database";

const STATUS_STYLES: Record<ReviewStatus, string> = {
  pending: "bg-slate-100 text-slate-500",
  self_review: "bg-blue-100 text-blue-600",
  manager_review: "bg-violet-100 text-violet-600",
  peer_review: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
};

export default async function ReviewsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const isAdmin = hasRole(session.user.role, "hr");
  const { data } = await supabaseAdmin
    .from("review_cycles")
    .select("*")
    .order("start_date", { ascending: false });

  const cycles = (data ?? []) as unknown as ReviewCycleRow[];

  // My pending reviews (where I'm a reviewer)
  const { data: myReviews } = await supabaseAdmin
    .from("performance_reviews")
    .select("id, cycle_id, reviewee_id, review_type, submitted_at")
    .eq("reviewer_id", session.user.id)
    .is("submitted_at", null);

  const pendingCount = (myReviews ?? []).length;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Performance Reviews</h1>
          <p className="mt-1 text-sm text-slate-500">
            {pendingCount > 0 ? (
              <span className="text-amber-600 font-medium">{pendingCount} review{pendingCount > 1 ? "s" : ""} awaiting your input</span>
            ) : "All reviews up to date"}
          </p>
        </div>
        {isAdmin && <NewCycleButton userId={session.user.id} />}
      </div>

      {cycles.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-slate-400">No review cycles yet.</p>
          {isAdmin && <p className="text-xs text-slate-400 mt-1">Create one above to kick off a review round.</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {cycles.map((c, i) => (
            <Link
              key={c.id}
              href={`/pulse/reviews/${c.id}`}
              className={`flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors ${i > 0 ? "border-t border-slate-100" : ""}`}
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 capitalize">
                  {c.cycle} · {new Date(c.start_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })} – {new Date(c.end_date).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[c.status]}`}>
                {c.status.replace("_", " ")}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
