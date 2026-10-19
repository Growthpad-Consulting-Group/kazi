"use client";

import { useState, useTransition } from "react";
import { addNote } from "../actions";

export function NoteForm({ candidateId }: { candidateId: string }) {
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    startTransition(async () => {
      await addNote(candidateId, note.trim());
      setNote("");
    });
  }

  return (
    <form onSubmit={submit} className="flex gap-2">
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note…"
        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
      />
      <button
        type="submit"
        disabled={isPending || !note.trim()}
        className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40 transition-colors"
      >
        {isPending ? "…" : "Add"}
      </button>
    </form>
  );
}
