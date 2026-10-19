import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasRole } from "@/lib/rbac";
import Link from "next/link";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return null;
  const isHr = hasRole(session.user.role, "hr");

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">System administration and compliance tools</p>
      </div>

      {isHr && (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Data Exports</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ExportCard
                label="Export Candidates"
                description="All candidates with stage, AI score and job"
                href="/api/export/candidates"
              />
              <ExportCard
                label="Export Employees"
                description="Active and inactive employee roster"
                href="/api/export/employees"
              />
              <ExportCard
                label="Export Reviews"
                description="Performance review summaries by cycle"
                href="/api/export/reviews"
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Compliance</h2>
            <Link href="/settings/data-retention"
              className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-5 hover:bg-amber-100 transition-colors">
              <div>
                <p className="text-sm font-semibold text-amber-900">Candidate Data Retention</p>
                <p className="text-xs text-amber-700 mt-0.5">Review and delete stale records — ODPC / Kenya Data Protection Act compliance</p>
              </div>
              <span className="text-amber-400 text-lg">→</span>
            </Link>
          </section>
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Account</h2>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <p className="text-sm text-slate-700"><span className="font-medium">Name:</span> {session.user.name}</p>
          <p className="text-sm text-slate-700"><span className="font-medium">Email:</span> {session.user.email}</p>
          <p className="text-sm text-slate-700 capitalize"><span className="font-medium">Role:</span> {session.user.role.replace("_", " ")}</p>
        </div>
      </section>
    </div>
  );
}

function ExportCard({ label, description, href }: { label: string; description: string; href: string }) {
  return (
    <a href={href} download
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col gap-1">
      <p className="text-sm font-semibold text-slate-900">{label}</p>
      <p className="text-xs text-slate-400">{description}</p>
      <p className="text-xs text-blue-600 mt-auto pt-2">↓ Download CSV</p>
    </a>
  );
}
