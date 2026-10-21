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

  const [kudos, privateFeedback, usersResult] = await Promise.all([
    getPublicFeedback(30),
    getMyPrivateFeedback(session.user.id),
    supabaseAdmin.from("users").select("id, name").eq("is_active", true).order("name"),
  ]);
  const users = (usersResult.data ?? []) as unknown as UserRow[];
  const teammatesRecognised = new Set(kudos.map((item) => item.to_user_id)).size;
  const givenByYou = kudos.filter((item) => item.from_user_id === session.user.id).length;

  return <>
    <SetPageHeader title="Feedback and recognition" description={`${kudos.length} shared moment${kudos.length === 1 ? "" : "s"} · ${privateFeedback.length} private for you`} icon="solar:star-fall-broken" />
    <div className="mx-auto max-w-7xl space-y-5">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard title="Shared recognition" value={kudos.length} icon="solar:star-fall-broken" color="orange" compact subtitle="Across the team" /><StatCard title="Private feedback" value={privateFeedback.length} icon="solar:letter-broken" color={privateFeedback.length ? "blue" : "slate"} compact subtitle={privateFeedback.length ? "For your growth" : "Your inbox is clear"} /><StatCard title="Teammates recognised" value={teammatesRecognised} icon="solar:users-group-two-rounded-broken" color="green" compact subtitle="On the recognition wall" /><StatCard title="Given by you" value={givenByYou} icon="solar:heart-broken" color="amber" compact subtitle="Public shout-outs" /></section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <FeedbackWall kudos={kudos} />
        <aside className="space-y-5"><SendFeedbackForm fromUserId={session.user.id} users={users.filter((user) => user.id !== session.user.id)} />
          <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-xl shadow-slate-200/40 dark:shadow-black/20"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600"><Icon icon="solar:letter-broken" className="h-4 w-4" /></span><h2 className="text-sm font-semibold text-[var(--text-hi)]">Private inbox</h2></div><span className="font-mono text-xs font-bold text-blue-600">{privateFeedback.length}</span></div>{privateFeedback.length ? <div className="mt-4 space-y-2">{privateFeedback.slice(0, 4).map((item) => <div key={item.id} className="rounded-xl bg-blue-500/[0.05] px-3 py-3"><p className="line-clamp-3 text-xs leading-relaxed text-[var(--text-hi)]">{item.message}</p><p className="mt-2 text-[10px] text-[var(--text-lo)]">From {item.from?.name ?? "Anonymous"} · {new Date(item.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}</p></div>)}</div> : <div className="mt-4 rounded-xl bg-[var(--surface-2)] px-3 py-5 text-center"><Icon icon="solar:check-circle-broken" className="mx-auto h-5 w-5 text-emerald-500" /><p className="mt-2 text-xs font-semibold text-[var(--text-hi)]">Nothing waiting</p><p className="mt-1 text-[11px] text-[var(--text-lo)]">Private feedback for you appears here.</p></div>}</section>
        </aside>
      </div>
    </div>
  </>;
}
