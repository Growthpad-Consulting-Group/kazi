"use client";

import { useState } from "react";

const KUDOS_EMOJIS = ["🔥", "💪", "⭐", "🙌", "💡", "🚀", "❤️", "👏"];

interface Props {
  fromUserId: string;
  users: { id: string; name: string }[];
}

export function SendFeedbackForm({ fromUserId, users }: Props) {
  const [toUserId, setToUserId] = useState(users[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [emoji, setEmoji] = useState("⭐");
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!message.trim() || !toUserId) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/pulse/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_user_id: fromUserId,
          to_user_id: toUserId,
          message,
          visibility,
          emoji: visibility === "public" ? emoji : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setSent(true);
      setMessage("");
      setTimeout(() => setSent(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 space-y-4">
      <h2 className="text-sm font-semibold text-slate-700">Send Feedback</h2>

      {/* Public / Private toggle */}
      <div className="flex gap-2">
        {(["public", "private"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVisibility(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${visibility === v ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
          >
            {v === "public" ? "🌟 Shout-out (public)" : "🔒 Private feedback"}
          </button>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
        <select
          value={toUserId}
          onChange={(e) => setToUserId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {visibility === "public" && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Emoji</label>
          <div className="flex gap-2 flex-wrap">
            {KUDOS_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={`w-9 h-9 rounded-xl text-xl transition-colors ${emoji === e ? "bg-amber-100 ring-2 ring-amber-400" : "bg-slate-100 hover:bg-slate-200"}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Message</label>
        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={visibility === "public" ? "What did they do that deserves recognition?" : "Share constructive, specific feedback…"}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}
      {sent && <p className="text-xs text-green-600">Sent!</p>}

      <button
        onClick={submit}
        disabled={saving || !message.trim() || !toUserId}
        className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
      >
        {saving ? "Sending…" : "Send"}
      </button>
    </div>
  );
}
