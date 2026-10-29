import { Icon } from "@iconify/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import StatCard from "@/components/ui/StatCard";
import { getPublicFeedback, getMyPrivateFeedback } from "../actions";
import { FeedbackWall } from "./FeedbackWall";
import { SendRecognitionButton } from "./SendRecognitionButton";

type UserRow = { id: string; name: string };

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const [
    kudos,
    privateFeedback,
    usersResult,
    valuesResult,
    campaignsResult,
    groupsResult,
  ] = await Promise.all([
    getPublicFeedback(30),
    getMyPrivateFeedback(session.user.id),
    supabaseAdmin
      .from("users")
      .select("id, name")
      .eq("is_active", true)
      .order("name"),
    supabaseAdmin
      .from("recognition_values")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name"),
    supabaseAdmin
      .from("recognition_campaigns")
      .select("id, name")
      .eq("status", "live")
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("staff_groups")
      .select("id, name, member_ids")
      .order("name"),
  ]);
  const users = (usersResult.data ?? []) as unknown as UserRow[];
  const values = (valuesResult.data ?? []) as unknown as {
    id: string;
    name: string;
    color: string;
  }[];
  const campaigns = (campaignsResult.data ?? []) as unknown as {
    id: string;
    name: string;
  }[];
  const groups = (groupsResult.data ?? []) as unknown as {
    id: string;
    name: string;
    member_ids: string[];
  }[];
  const receivedByYou = kudos.filter(
    (item) => item.to_user_id === session.user.id,
  ).length;
  const givenByYou = kudos.filter(
    (item) => item.from_user_id === session.user.id,
  ).length;

  return (
    <>
      <SetPageHeader
        title="Recognition"
        description="Celebrate great work and share feedback with your team."
        icon="solar:star-fall-broken"
        trailing={
          <SendRecognitionButton
            fromUserId={session.user.id}
            users={users.filter((user) => user.id !== session.user.id)}
            values={values}
            campaigns={campaigns}
            groups={groups}
          />
        }
      />
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid grid-cols-3 gap-3">
          <StatCard
            variant="inline"
            compact
            title="Shared"
            value={kudos.length}
            icon="solar:star-fall-broken"
            color="orange"
            subtitle="On the wall"
          />
          <StatCard
            variant="inline"
            compact
            title="Received"
            value={receivedByYou}
            icon="solar:heart-angle-broken"
            color="green"
            subtitle="Recognised by others"
          />
          <StatCard
            variant="inline"
            compact
            title="Given"
            value={givenByYou}
            icon="solar:hand-heart-broken"
            color="blue"
            subtitle="Your shout-outs"
          />
        </section>

        <FeedbackWall kudos={kudos} values={values} />

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl shadow-slate-200/50 transition-shadow duration-200 hover:shadow-2xl dark:shadow-black/20">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <Icon icon="solar:letter-broken" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-hi)]">
                  Private inbox
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-lo)]">
                  Feedback shared directly with you.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] font-semibold text-[var(--text-lo)]">
              {privateFeedback.length}
            </span>
          </div>
          {privateFeedback.length ? (
            <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
              {privateFeedback.slice(0, 6).map((item) => (
                <article
                  key={item.id}
                  className="rounded-xl bg-blue-500/[0.05] p-4"
                >
                  <p className="line-clamp-4 text-xs leading-relaxed text-[var(--text-hi)]">
                    {item.message}
                  </p>
                  <p className="mt-3 text-[10px] text-[var(--text-lo)]">
                    From {item.from?.name ?? "Anonymous"} ·{" "}
                    {new Date(item.created_at).toLocaleDateString("en-KE", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
              <Icon
                icon="solar:letter-broken"
                className="h-6 w-6 text-[var(--text-lo)] opacity-50"
              />
              <p className="mt-2 text-xs text-[var(--text-lo)]">
                Your inbox is clear.
              </p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
