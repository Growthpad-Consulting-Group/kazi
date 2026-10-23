import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { getPublicFeedback, getMyPrivateFeedback } from "../actions";
import { FeedbackWall } from "./FeedbackWall";
import { SendFeedbackForm } from "./SendFeedbackForm";

type UserRow = { id: string; name: string };

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const [kudos, privateFeedback, usersResult, valuesResult, campaignsResult, groupsResult] = await Promise.all([
    getPublicFeedback(30),
    getMyPrivateFeedback(session.user.id),
    supabaseAdmin.from("users").select("id, name").eq("is_active", true).order("name"),
    supabaseAdmin.from("recognition_values").select("id, name, color").eq("is_active", true).order("name"),
    supabaseAdmin.from("recognition_campaigns").select("id, name").eq("status", "live").order("created_at", { ascending: false }),
    supabaseAdmin.from("staff_groups").select("id, name, member_ids").order("name"),
  ]);
  const users = (usersResult.data ?? []) as unknown as UserRow[];
  const values = (valuesResult.data ?? []) as unknown as { id: string; name: string; color: string }[];
  const campaigns = (campaignsResult.data ?? []) as unknown as { id: string; name: string }[];
  const groups = (groupsResult.data ?? []) as unknown as { id: string; name: string; member_ids: string[] }[];
  const recognised = new Set(kudos.map((item) => item.to_user_id)).size;
  const givenByYou = kudos.filter((item) => item.from_user_id === session.user.id).length;
  const latest = kudos[0];

  return <>
    <SetPageHeader title="Feedback and recognition" description="Celebrate great work, reinforce values, and share useful feedback." icon="solar:star-fall-broken" />
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="relative overflow-hidden rounded-2xl border border-brand-500/20 bg-gradient-to-r from-brand-500/[0.08] via-orange-400/[0.04] to-transparent p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20 sm:p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg shadow-brand-500/25"><Icon icon="solar:star-fall-broken" className="h-5 w-5" /></span><div><p className="text-sm font-semibold text-[var(--text-hi)]">Make the good work visible</p><p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--text-lo)]">A thoughtful shout-out helps the whole team see what excellent collaboration looks like.</p></div></div>
          <div className="rounded-xl bg-[var(--surface)]/80 px-3.5 py-2.5 text-sm shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-lo)]">Latest recognition</p><p className="mt-1 max-w-xs truncate text-xs font-semibold text-[var(--text-hi)]">{latest ? "For " + (latest.to?.name ?? "a teammate") : "Ready for the first shout-out"}</p></div>
        </div>
      </section>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard variant="inline" compact title="Shared" value={kudos.length} icon="solar:star-fall-broken" color="orange" subtitle="Recognition wall" />
        <StatCard variant="inline" compact title="Private" value={privateFeedback.length} icon="solar:letter-broken" color={privateFeedback.length ? "blue" : "slate"} subtitle={privateFeedback.length ? "Feedback for you" : "Inbox clear"} />
        <StatCard variant="inline" compact title="Recognised" value={recognised} icon="solar:users-group-two-rounded-broken" color="green" subtitle="Teammates celebrated" />
        <StatCard variant="inline" compact title="Given by you" value={givenByYou} icon="solar:heart-broken" color="amber" subtitle="Public shout-outs" />
      </section>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <FeedbackWall kudos={kudos} values={values} />
        <aside className="space-y-5">
          <SendFeedbackForm fromUserId={session.user.id} users={users.filter((user) => user.id !== session.user.id)} values={values} campaigns={campaigns} groups={groups} />
          <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/40 dark:shadow-black/20">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Icon icon="solar:letter-broken" className="h-4 w-4" /></span><div><h2 className="text-sm font-semibold text-[var(--text-hi)]">Private inbox</h2><p className="mt-0.5 text-xs text-[var(--text-lo)]">Feedback shared directly with you.</p></div></div><span className="rounded-full bg-blue-500/10 px-2.5 py-1 font-mono text-[10px] font-bold text-blue-600">{privateFeedback.length}</span></div>
            {privateFeedback.length ? <div className="space-y-2 p-3">{privateFeedback.slice(0, 4).map((item) => <article key={item.id} className="rounded-xl bg-blue-500/[0.05] p-3"><p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-hi)]">{item.message}</p><p className="mt-2 text-[10px] text-[var(--text-lo)]">From {item.from?.name ?? "Anonymous"} · {new Date(item.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p></article>)}</div> : <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><Icon icon="solar:check-circle-broken" className="h-4 w-4" /></span><p className="mt-2 text-xs font-semibold text-[var(--text-hi)]">Nothing waiting</p><p className="mt-1 text-[11px] text-[var(--text-lo)]">Private feedback for you appears here.</p></div>}
          </section>
        </aside>
      </div>
    </div>
  </>;
}
