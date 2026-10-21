import { getCachedPeople } from "@/lib/cache/queries";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDepartments } from "@/features/departments/actions";
import PeopleClientView from "./PeopleClientView";
import SetPageHeader from "@/components/ui/SetPageHeader";
import { NewPersonButton } from "./NewPersonButton";
import { supabaseAdmin } from "@/lib/supabase";

type SignatureProfileResult = { data: unknown; error: { message: string } | null };
type SignatureProfileDatabase = { from: (table: string) => { select: (columns: string) => PromiseLike<SignatureProfileResult> } };

export default async function PeoplePage() {
  const signatureDatabase = supabaseAdmin as unknown as SignatureProfileDatabase;
  const [people, session, signatureProfiles] = await Promise.all([getCachedPeople(), getServerSession(authOptions), signatureDatabase.from("signature_staff_profiles").select("id, user_id")]);
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  if (signatureProfiles.error) throw new Error(signatureProfiles.error.message);
  const signatureProfileByUser = new Map(((signatureProfiles.data ?? []) as { id: string; user_id: string | null }[]).filter((profile) => profile.user_id).map((profile) => [profile.user_id!, profile.id]));
  const enriched = people.map((p) => ({
    ...p,
    manager_name: p.manager_id ? byId[p.manager_id]?.name ?? null : null,
    signature_profile_id: signatureProfileByUser.get(p.id) ?? null,
  }));

  const listed = await getDepartments().catch(() => [] as string[]);
  const departments = Array.from(
    new Set([...listed, ...(people.map((p) => p.department).filter(Boolean) as string[])])
  ).sort((a, b) => a.localeCompare(b));

  const locations = Array.from(
    new Set(people.map((p) => p.location).filter(Boolean) as string[])
  ).sort();
  const managers = people
    .filter((person) => ["admin", "hr", "manager", "hiring_manager"].includes(person.role))
    .map((person) => ({ id: person.id, name: person.name, job_title: person.job_title }));

  return (
    <>
      <SetPageHeader
        title="Staff"
        description={`${people.length} staff members`}
        icon="solar:user-id-broken"
        trailing={<NewPersonButton departments={departments} managers={managers} canCreateAdmin={session?.user.role === "admin"} />}
      />
      <PeopleClientView
        people={enriched}
        departments={departments}
        locations={locations}
        currentUserId={session?.user.id ?? ""}
        canManageStaff={session?.user.role === "admin" || session?.user.role === "hr"}
      />
    </>
  );
}
