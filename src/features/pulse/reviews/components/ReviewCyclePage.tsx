import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { Icon } from "@iconify/react";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { ReviewForm } from "./ReviewForm";
import type { ReviewCycleRow, PerformanceReview, ReviewStatus, ReviewType } from "@/types/database";

type UserRow = { id: string; name: string; job_title: string | null };

const STATUS: Record<ReviewStatus, { label: string; tone: string; icon: string }> = {
  pending: { label: "Planning", tone: "bg-slate-500/10 text-slate-600", icon: "solar:calendar-minimalistic-broken" },
  self_review: { label: "Self review", tone: "bg-blue-500/10 text-blue-600", icon: "solar:user-check-broken" },
  manager_review: { label: "Manager review", tone: "bg-amber-500/10 text-amber-700", icon: "solar:users-group-two-rounded-broken" },
  peer_review: { label: "Peer review", tone: "bg-sky-500/10 text-sky-700", icon: "solar:users-group-two-rounded-broken" },
  completed: { label: "Completed", tone: "bg-emerald-500/10 text-emerald-700", icon: "solar:check-circle-broken" },
};

const REVIEW_TYPE_LABEL: Record<ReviewType, string> = { self: "Self review", manager: "Manager review", peer: "Peer review" };

function date(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-KE", options);
}

function Initial({ name }: { name: string }) {
  return <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f05d23] to-orange-400 text-xs font-bold text-white">{name.slice(0, 1).toUpperCase()}</span>;
}

export default async function ReviewCyclePage({ cycleId }: { cycleId: string }) {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { data: cycleData } = await supabaseAdmin.from("review_cycles").select("*").eq("id", cycleId).single();
  if (!cycleData) notFound();
  const cycle = cycleData as unknown as ReviewCycleRow;

  const { data: reviewsData } = await supabaseAdmin.from("performance_reviews").select("*").eq("cycle_id", cycleId);
  const reviews = (reviewsData ?? []) as unknown as PerformanceReview[];
  const myReviews = reviews.filter((review) => review.reviewer_id === session.user.id && !review.submitted_at);
  const completedByMe = reviews.filter((review) => review.reviewer_id === session.user.id && review.submitted_at);
  const submitted = reviews.filter((review) => review.submitted_at);
  const completion = reviews.length ? Math.round((submitted.length / reviews.length) * 100) : 0;

  const revieweeIds = [...new Set(reviews.map((review) => review.reviewee_id))];
  const { data: usersData } = revieweeIds.length
    ? await supabaseAdmin.from("users").select("id, name, job_title").in("id", revieweeIds)
    : { data: [] };
  const users: Record<string, UserRow> = Object.fromEntries(((usersData ?? []) as unknown as UserRow[]).map((user) => [user.id, user]));
  const status = STATUS[cycle.status];
  const typeCounts = (Object.keys(REVIEW_TYPE_LABEL) as ReviewType[]).map((type) => ({ type, count: reviews.filter((review) => review.review_type === type).length }));

  return (
    <>
      <SetPageHeader title={cycle.title} description={`${status.label} · ${date(cycle.start_date)} – ${date(cycle.end_date)}`} icon="solar:clipboard-list-broken" />

      <div className="mx-auto max-w-7xl space-y-5">
        <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-5 py-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:px-6">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#f05d23]/10 blur-3xl" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#f05d23]/12 text-[#f05d23]"><Icon icon="solar:clipboard-list-broken" className="h-5 w-5" /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold text-[var(--text-hi)] sm:text-xl">{cycle.title}</h1>
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold ${status.tone}`}><Icon icon={status.icon} className="h-3 w-3" />{status.label}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-lo)]"><span className="capitalize">{cycle.cycle}</span> cycle · {date(cycle.start_date)} – {date(cycle.end_date)}</p>
              </div>
            </div>
            <Link href="/pulse/reviews" className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text-hi)] transition-colors hover:bg-[var(--surface-2)]"><Icon icon="solar:alt-arrow-left-broken" className="h-4 w-4" />All cycles</Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Assigned" value={reviews.length} icon="solar:clipboard-list-broken" color="blue" compact subtitle="Review requests" />
          <StatCard title="Awaiting you" value={myReviews.length} icon="solar:pen-new-square-broken" color={myReviews.length ? "amber" : "green"} compact subtitle={myReviews.length ? "Ready for your input" : "You are caught up"} />
          <StatCard title="Submitted" value={submitted.length} icon="solar:check-circle-broken" color="green" compact subtitle={`${completion}% complete`} />
          <StatCard title="Cycle closes" value={date(cycle.end_date, { month: "short", day: "numeric" })} icon="solar:calendar-mark-broken" color="orange" compact subtitle={date(cycle.end_date, { year: "numeric" })} />
        </section>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <main className="min-w-0 space-y-5">
            {myReviews.length > 0 ? (
              <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
                  <div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Your review queue</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Complete each review before the cycle closes.</p></div>
                  <span className="rounded-lg bg-amber-500/10 px-2 py-1 font-mono text-[10px] font-bold text-amber-700">{myReviews.length} open</span>
                </div>
                <div className="divide-y divide-[var(--border)]">
                  {myReviews.map((review) => {
                    const person = users[review.reviewee_id];
                    const name = person?.name ?? "Team member";
                    return (
                      <article key={review.id} className="p-5 sm:p-6">
                        <div className="mb-5 flex flex-wrap items-center gap-3">
                          <Initial name={name} />
                          <div className="min-w-0 flex-1"><h3 className="text-sm font-semibold text-[var(--text-hi)]">{name}</h3><p className="mt-0.5 text-xs text-[var(--text-lo)]">{person?.job_title ?? "Team member"} · {REVIEW_TYPE_LABEL[review.review_type as ReviewType]}</p></div>
                          <span className="rounded-lg bg-blue-500/10 px-2 py-1 text-[10px] font-semibold capitalize text-blue-600">{review.review_type}</span>
                        </div>
                        <ReviewForm review={review} cycleId={cycleId} revieweeId={review.reviewee_id} reviewType={review.review_type as ReviewType} />
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-5 text-center"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600"><Icon icon="solar:check-circle-broken" className="h-5 w-5" /></span><h2 className="mt-3 text-sm font-semibold text-[var(--text-hi)]">Your queue is clear</h2><p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--text-lo)]">There are no review requests waiting for your input in this cycle.</p></section>
            )}

            {completedByMe.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Submitted by you</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">A record of the feedback you have completed.</p></div><span className="rounded-lg bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-bold text-emerald-700">{completedByMe.length} done</span></div>
                <div className="divide-y divide-[var(--border)]">{completedByMe.map((review) => { const person = users[review.reviewee_id]; const name = person?.name ?? "Team member"; return <div key={review.id} className="flex items-center gap-3 px-5 py-3.5"><Initial name={name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-hi)]">{name}</p><p className="mt-0.5 text-xs text-[var(--text-lo)]">{REVIEW_TYPE_LABEL[review.review_type as ReviewType]}</p></div>{review.overall_rating && <span className="rounded-lg bg-[#f05d23]/10 px-2 py-1 text-xs font-semibold text-[#f05d23]">{review.overall_rating}/5</span>}<Icon icon="solar:check-circle-broken" className="h-4 w-4 text-emerald-500" /></div>; })}</div>
              </section>
            )}
          </main>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-[var(--text-hi)]">Cycle progress</p><p className="mt-0.5 text-xs text-[var(--text-lo)]">All assigned feedback</p></div><span className="font-mono text-xl font-bold text-[#f05d23]">{completion}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]"><div className="h-full rounded-full bg-gradient-to-r from-[#f05d23] to-orange-400 transition-all" style={{ width: `${completion}%` }} /></div><p className="mt-2 text-xs text-[var(--text-lo)]">{submitted.length} of {reviews.length} submitted</p></section>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f05d23]/10 text-[#f05d23]"><Icon icon="solar:users-group-two-rounded-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Review mix</h2><p className="text-[11px] text-[var(--text-lo)]">Requests in this cycle</p></div></div><div className="mt-3 space-y-2">{typeCounts.map(({ type, count }) => <div key={type} className="flex items-center justify-between rounded-xl bg-[var(--surface-2)] px-3 py-2"><span className="text-xs font-medium text-[var(--text-hi)]">{REVIEW_TYPE_LABEL[type]}</span><span className="font-mono text-xs font-bold text-[var(--text-lo)]">{count}</span></div>)}</div></section>
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Icon icon="solar:calendar-broken" className="h-4 w-4" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">Cycle window</h2></div><div className="mt-3 space-y-3 border-l border-[var(--border)] pl-3"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-lo)]">Opened</p><p className="mt-0.5 text-xs font-medium text-[var(--text-hi)]">{date(cycle.start_date)}</p></div><div><p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-lo)]">Closes</p><p className="mt-0.5 text-xs font-medium text-[var(--text-hi)]">{date(cycle.end_date)}</p></div></div></section>
          </aside>
        </div>
      </div>
    </>
  );
}
