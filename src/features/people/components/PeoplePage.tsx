import { supabaseAdmin } from "@/lib/supabase";
import PeopleClientView from "./PeopleClientView";
import PageHeader from "@/components/ui/PageHeader";

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

async function getPeople() {
  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name, email, role, department, job_title, location, manager_id")
    .order("name");
  return (data ?? []) as unknown as UserRow[];
}

export default async function PeoplePage() {
  const people = await getPeople();
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  const enriched = people.map((p) => ({
    ...p,
    manager_name: p.manager_id ? byId[p.manager_id]?.name ?? null : null,
  }));

  const departments = Array.from(
    new Set(people.map((p) => p.department).filter(Boolean) as string[])
  ).sort();

  const locations = Array.from(
    new Set(people.map((p) => p.location).filter(Boolean) as string[])
  ).sort();

  return (
    <div className="space-y-0">
      <PageHeader
        title="People"
        description={`${people.length} team members`}
        icon="solar:users-group-two-rounded-broken"
        actions={[
          {
            label: "Add Person",
            icon: "solar:add-circle-broken",
            href: "/people/new",
            variant: "primary",
          },
        ]}
      />

      <PeopleClientView people={enriched} departments={departments} locations={locations} />
    </div>
  );
}
