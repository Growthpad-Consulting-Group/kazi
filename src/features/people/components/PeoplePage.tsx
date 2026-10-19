import { supabaseAdmin } from "@/lib/supabase";
import Link from "next/link";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  manager_id: string | null;
};

async function getPeople(): Promise<UserRow[]> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name, email, role, department, job_title, location, manager_id")
    .order("name");
  return (data ?? []) as unknown as UserRow[];
}

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-red-100 text-red-700",
  hr: "bg-pink-100 text-pink-700",
  hiring_manager: "bg-blue-100 text-blue-700",
  manager: "bg-violet-100 text-violet-700",
  interviewer: "bg-amber-100 text-amber-700",
  employee: "bg-slate-100 text-slate-600",
};

export default async function PeoplePage() {
  const people = await getPeople();
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  const grouped: Record<string, UserRow[]> = {};
  for (const p of people) {
    const dept = p.department ?? "No Department";
    (grouped[dept] ??= []).push(p);
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">People</h1>
          <p className="mt-1 text-sm text-slate-500">{people.length} team members</p>
        </div>
        <Link
          href="/people/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          + Add Person
        </Link>
      </div>

      {Object.entries(grouped).sort().map(([dept, members]) => (
        <div key={dept}>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            {dept} · {members.length}
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {members.map((p, i) => {
              const manager = p.manager_id ? byId[p.manager_id] : null;
              return (
                <div
                  key={p.id}
                  className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-slate-100" : ""}`}
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0 text-sm font-semibold text-slate-600">
                    {p.name.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 truncate">{p.name}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium flex-shrink-0 ${ROLE_BADGE[p.role] ?? "bg-slate-100 text-slate-600"}`}>
                        {p.role.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {p.job_title ?? p.email}
                      {manager ? ` · reports to ${manager.name}` : ""}
                      {p.location ? ` · ${p.location}` : ""}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/pulse/checkins?user=${p.id}`}
                      className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      Check-ins
                    </Link>
                    <Link
                      href={`/pulse/one-on-ones?report=${p.id}`}
                      className="text-xs text-slate-400 hover:text-slate-700 transition-colors"
                    >
                      1-on-1s
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
