import { supabaseAdmin } from "@/lib/supabase";
import SetPageHeader from "@/components/ui/SetPageHeader";
import {
  summariseUsefulness,
  type QueueRow,
} from "@/features/pulse/measurement";

const DAY = 86_400_000;

const LABELS: Record<string, string> = {
  review_acknowledgement: "Review acknowledgement",
  daily_log: "Daily log",
  weekly_checkin: "Weekly check-in",
  survey: "Survey",
  side_quest: "Side Quest evidence",
  wall_of_fame: "Wall of Fame",
  one_on_one_prep: "1-on-1 preparation",
  action_items: "Action items",
  flagged_team_member: "Flagged team member",
  voice_out_case: "Voice Out case",
  overtime_request: "Overtime request",
  checkin_review: "Check-in review",
  review_to_complete: "Review to complete",
  reward_redemption: "Reward redemption",
  side_quest_approval: "Side Quest approval",
  overdue_scorecard: "Overdue scorecard",
};

function formatHours(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 24) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} d`;
}

export default async function PromptUsefulnessPage() {
  // Read once per request on the server; the window is fixed for this render.
  // eslint-disable-next-line react-hooks/purity -- server component; the time is a per-request input
  const since = new Date(Date.now() - 90 * DAY).toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed tables
  const db = supabaseAdmin as any;
  const [queue, clicks] = await Promise.all([
    db
      .from("pulse_queue_items")
      .select("user_id, kind, first_seen_at, resolved_at")
      .gte("first_seen_at", since),
    db.from("pulse_link_clicks").select("kind").gte("clicked_at", since),
  ]);

  const rows = summariseUsefulness(
    (queue.data ?? []) as QueueRow[],
    (clicks.data ?? []) as { kind: string }[],
  );

  return (
    <div className="space-y-5">
      <SetPageHeader
        title="Prompt usefulness"
        description="How the Pulse prompts are used over the last 90 days. Counts appear only for groups of five or more people, so no individual can be identified."
        icon="solar:chart-2-broken"
      />
      <section className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs text-[var(--text-lo)]">
            <tr>
              <th className="px-4 py-3 font-semibold">Prompt</th>
              <th className="px-4 py-3 font-semibold">People shown</th>
              <th className="px-4 py-3 font-semibold">Cleared</th>
              <th className="px-4 py-3 font-semibold">Median time to clear</th>
              <th className="px-4 py-3 font-semibold">Clicks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.kind} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 text-[var(--text-hi)]">
                  {LABELS[row.kind] ?? row.kind}
                </td>
                {row.suppressed ? (
                  <td
                    colSpan={4}
                    className="px-4 py-3 text-xs text-[var(--text-lo)]"
                  >
                    Too few people to show without identifying anyone.
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 font-mono">{row.people}</td>
                    <td className="px-4 py-3 font-mono">{row.resolved}</td>
                    <td className="px-4 py-3 font-mono">
                      {formatHours(row.medianHoursToResolve)}
                    </td>
                    <td className="px-4 py-3 font-mono">{row.clicks}</td>
                  </>
                )}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-6 text-center text-xs text-[var(--text-lo)]"
                >
                  No prompt activity recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
