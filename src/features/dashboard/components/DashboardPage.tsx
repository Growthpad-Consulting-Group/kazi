import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">
        Welcome back, {session?.user.name?.split(" ")[0]}
      </h1>
      <p className="mt-1 text-sm text-slate-500 capitalize">
        {session?.user.role.replace("_", " ")} · {session?.user.department ?? "Growthpad"}
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Open Jobs" value="—" />
        <StatCard label="Active Candidates" value="—" />
        <StatCard label="Pending Review" value="—" />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
