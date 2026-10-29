"use client";

import { useState, useTransition } from "react";
import { addNote } from "../actions";
import { Button } from "@/components/ui/Button";

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
        className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-hi)] outline-none focus:ring-2 focus:ring-brand-500/30"
      />
      <Button
        type="submit"
        disabled={isPending || !note.trim()}
        loading={isPending}
        size="sm"
        icon="solar:add-circle-broken"
      >
        Add note
      </Button>
    </form>
  );
}
