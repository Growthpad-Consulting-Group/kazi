import type { FeedbackWithUsers } from "../actions";

export function FeedbackWall({ kudos }: { kudos: FeedbackWithUsers[] }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Recognition Wall ({kudos.length})
      </h2>
      {kudos.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="text-sm text-slate-400">No shout-outs yet. Be the first to recognise a teammate!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {kudos.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{f.emoji ?? "⭐"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{f.to?.name ?? "—"}</p>
                  <p className="text-xs text-slate-400 mb-2">from {f.from?.name ?? "—"}</p>
                  <p className="text-sm text-slate-700">{f.message}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                {new Date(f.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
