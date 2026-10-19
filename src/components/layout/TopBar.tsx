"use client";

import { signOut } from "next-auth/react";
import type { UserRole } from "@/types/database";

interface Props {
  user: {
    name: string;
    email: string;
    image?: string | null;
    role: UserRole;
  };
}

export function TopBar({ user }: Props) {
  return (
    <header className="h-14 flex-shrink-0 flex items-center justify-between px-6 bg-white border-b border-slate-200">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{user.name}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
