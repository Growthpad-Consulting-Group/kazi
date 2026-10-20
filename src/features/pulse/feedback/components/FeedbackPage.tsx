import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getPublicFeedback, getMyPrivateFeedback } from "../actions";
import { FeedbackWall } from "./FeedbackWall";
import { SendFeedbackForm } from "./SendFeedbackForm";

type UserRow = { id: string; name: string };

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const [kudos, privateFeedback, usersRes] = await Promise.all([
    getPublicFeedback(30),
    getMyPrivateFeedback(session.user.id),
    supabaseAdmin.from("users").select("id, name").order("name"),
  ]);

  const users = (usersRes.data ?? []) as unknown as UserRow[];

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Feedback & Recognition</h1>
        <p className="mt-1 text-sm text-slate-500">Shout out your teammates or share private feedback</p>
      </div>

      <SendFeedbackForm fromUserId={session.user.id} users={users.filter((u) => u.id !== session.user.id)} />

      {privateFeedback.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Private Feedback for You ({privateFeedback.length})
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden">
            {privateFeedback.map((f, i) => (
              <div key={f.id} className={`px-5 py-4 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                <p className="text-sm text-slate-700">{f.message}</p>
                <p className="text-xs text-slate-400 mt-1">
                  From {f.from?.name ?? "Anonymous"} · {new Date(f.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <FeedbackWall kudos={kudos} />
    </div>
  );
}
