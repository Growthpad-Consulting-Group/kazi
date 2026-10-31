import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { PipDetail } from "@/features/pulse/pips/components/PipDetail";
import type { Pip } from "@/types/database";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return null;

  const { id: userId, role } = session.user;

  const { data } = await supabaseAdmin
    .from("pips")
    .select("*")
    .eq("id", id)
    .single();
  if (!data) notFound();

  const pip = data as unknown as Pip;
  const isEditor =
    pip.manager_id === userId ||
    pip.hr_id === userId ||
    ["admin", "hr"].includes(role);
  if (pip.user_id !== userId && !isEditor) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- migration-backed check-in table
  const [employeeResult, checkinsResult] = await Promise.all([
    supabaseAdmin.from("users").select("name").eq("id", pip.user_id).single(),
    (supabaseAdmin as any)
      .from("pip_checkins")
      .select("id, author_id, note, created_at")
      .eq("pip_id", id)
      .order("created_at", { ascending: false }),
  ]);
  const employee = employeeResult.data;
  const checkins = (checkinsResult.data ?? []) as {
    id: string;
    author_id: string;
    note: string;
    created_at: string;
  }[];
  const authorIds: string[] = [
    ...new Set(
      checkins.map((checkin: { author_id: string }) => checkin.author_id),
    ),
  ];
  const { data: authors } = authorIds.length
    ? await supabaseAdmin.from("users").select("id, name").in("id", authorIds)
    : { data: [] };
  const authorNames = Object.fromEntries(
    (authors ?? []).map((author) => [author.id, author.name]),
  );

  return (
    <div className="p-8">
      <PipDetail
        pip={pip}
        employeeName={employee?.name ?? "Employee"}
        canEdit={isEditor}
        canActivateWithException={["admin", "hr"].includes(role)}
        isEmployee={pip.user_id === userId}
        checkins={checkins.map(
          (checkin: {
            id: string;
            author_id: string;
            note: string;
            created_at: string;
          }) => ({
            ...checkin,
            authorName: authorNames[checkin.author_id] ?? "Team member",
          }),
        )}
      />
    </div>
  );
}
