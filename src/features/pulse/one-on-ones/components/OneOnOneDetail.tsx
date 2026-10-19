"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OneOnOne } from "@/types/database";

type ActionItem = { text: string; done: boolean; carried_from?: string };

interface Props {
  session: OneOnOne;
  managerName: string;
  reportName: string;
  isManager: boolean;
}

export function OneOnOneDetail({ session: s, managerName, reportName, isManager }: Props) {
  const router = useRouter();
  const [agenda, setAgenda] = useState(s.agenda ?? "");
  const [notes, setNotes] = useState(s.notes ?? "");
  const [items, setItems] = useState<ActionItem[]>(s.action_items ?? []);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [talkingPoints, setTalkingPoints] = useState(s.ai_talking_points ?? "");

  async function save() {
    setSaving(true);
    await fetch(`/api/pulse/one-on-ones/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agenda, notes, action_items: items }),
    });
    setSaving(false);
    router.refresh();
  }

  async function generateTalkingPoints() {
    setAiLoading(true);
    const res = await fetch("/api/pulse/talking-points", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oneOnOneId: s.id }),
    });
    const json = await res.json();
    if (json.points) {
      setTalkingPoints(json.points);
    }
    setAiLoading(false);
  }

  function addItem() {
    if (!newItem.trim()) return;
    setItems([...items, { text: newItem.trim(), done: false }]);
    setNewItem("");
  }

  function toggleItem(i: number) {
    setItems(items.map((item, idx) => idx === i ? { ...item, done: !item.done } : item));
  }

  function removeItem(i: number) {
    setItems(items.filter((_, idx) => idx !== i));
  }

  const date = s.scheduled_at
    ? new Date(s.scheduled_at).toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "Unscheduled";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">1-on-1: {managerName} & {reportName}</h1>
        <p className="mt-1 text-sm text-slate-500">{date}</p>
      </div>

      {/* AI Talking Points */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">AI Talking Points</h2>
          <button
            onClick={generateTalkingPoints}
            disabled={aiLoading}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
          >
            {aiLoading ? "Generating…" : "Generate"}
          </button>
        </div>
        {talkingPoints ? (
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{talkingPoints}</p>
        ) : (
          <p className="text-sm text-slate-400">Click Generate to get AI-suggested talking points based on recent check-ins and open action items.</p>
        )}
      </div>

      {/* Shared Agenda */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Shared Agenda</h2>
        <textarea
          rows={5}
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
          placeholder="Add agenda items — both participants can edit this…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Notes */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Meeting Notes</h2>
        <textarea
          rows={5}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Post-meeting notes…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
        <h2 className="text-sm font-semibold text-slate-700">Action Items</h2>
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleItem(i)}
                className={`w-5 h-5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  item.done ? "bg-green-500 border-green-500 text-white" : "border-slate-300"
                }`}
              >
                {item.done && <span className="text-xs">✓</span>}
              </button>
              <span className={`flex-1 text-sm ${item.done ? "line-through text-slate-400" : "text-slate-700"}`}>
                {item.text}
                {item.carried_from && !item.done && (
                  <span className="ml-2 text-xs text-amber-500 font-medium">↩ carried over</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="text-slate-300 hover:text-red-400 transition-colors text-sm"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
            placeholder="Add action item…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          <button
            type="button"
            onClick={addItem}
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors"
          >
            Add
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
