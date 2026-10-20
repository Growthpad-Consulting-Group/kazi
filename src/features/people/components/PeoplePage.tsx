import { getCachedPeople } from "@/lib/cache/queries";
import { getDepartments } from "@/features/departments/actions";
import PeopleClientView from "./PeopleClientView";
import SetPageHeader from "@/components/ui/SetPageHeader";

export default async function PeoplePage() {
  const people = await getCachedPeople();
  const byId = Object.fromEntries(people.map((p) => [p.id, p]));

  const enriched = people.map((p) => ({
    ...p,
    manager_name: p.manager_id ? byId[p.manager_id]?.name ?? null : null,
  }));

  const listed = await getDepartments().catch(() => [] as string[]);
  const departments = Array.from(
    new Set([...listed, ...(people.map((p) => p.department).filter(Boolean) as string[])])
  ).sort((a, b) => a.localeCompare(b));

  const locations = Array.from(
    new Set(people.map((p) => p.location).filter(Boolean) as string[])
  ).sort();

  return (
    <>
      <SetPageHeader
        title="People"
        description={`${people.length} team members`}
        icon="solar:user-id-broken"
        actions={[{ label: "Add Person", icon: "solar:add-circle-broken", href: "/people/new", variant: "primary" }]}
      />
      <PeopleClientView people={enriched} departments={departments} locations={locations} />
    </>
  );
}
