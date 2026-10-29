import { supabaseAdmin } from "@/lib/supabase";
import type { SurveyAudienceType } from "@/types/database";

export type SurveyAudience = {
  survey_id: string;
  audience_type: SurveyAudienceType;
  user_id: string | null;
  staff_group_id: string | null;
  department: string | null;
  manager_id: string | null;
};

export type AudienceInput = {
  audienceType?: "all" | SurveyAudienceType;
  audienceIds?: unknown;
  audienceDepartments?: unknown;
};

type ActiveStaff = {
  id: string;
  department: string | null;
  manager_id: string | null;
};
type StaffGroup = { id: string; member_ids: string[] };

const VALID_AUDIENCES = new Set([
  "all",
  "staff",
  "staff_group",
  "department",
  "manager_group",
]);

function stringIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value.filter(
            (item): item is string =>
              typeof item === "string" && item.length > 0,
          ),
        ),
      ]
    : [];
}

export function validateAudience(input: AudienceInput):
  | {
      ok: true;
      type: "all" | SurveyAudienceType;
      ids: string[];
      departments: string[];
    }
  | { ok: false; error: string } {
  const type = input.audienceType ?? "all";
  if (!VALID_AUDIENCES.has(type))
    return { ok: false, error: "Choose a valid survey audience." };
  const ids = stringIds(input.audienceIds);
  const departments = stringIds(input.audienceDepartments);
  if (type === "department" && !departments.length)
    return { ok: false, error: "Choose at least one department." };
  if (type !== "all" && type !== "department" && !ids.length)
    return { ok: false, error: "Choose at least one audience target." };
  return { ok: true, type, ids, departments };
}

export function audienceRows(
  audience: Extract<ReturnType<typeof validateAudience>, { ok: true }>,
): Omit<SurveyAudience, "survey_id">[] {
  if (audience.type === "all") return [];
  if (audience.type === "department")
    return audience.departments.map((department) => ({
      audience_type: "department",
      user_id: null,
      staff_group_id: null,
      department,
      manager_id: null,
    }));
  const type = audience.type as SurveyAudienceType;
  return audience.ids.map((id) => ({
    audience_type: type,
    user_id: type === "staff" ? id : null,
    staff_group_id: type === "staff_group" ? id : null,
    department: null,
    manager_id: type === "manager_group" ? id : null,
  }));
}

export async function audienceUserIds(surveyId: string): Promise<string[]> {
  const [{ data: audienceRows }, { data: staff }, { data: groups }] =
    await Promise.all([
      supabaseAdmin
        .from("survey_audiences")
        .select(
          "survey_id,audience_type,user_id,staff_group_id,department,manager_id",
        )
        .eq("survey_id", surveyId),
      supabaseAdmin
        .from("users")
        .select("id,department,manager_id")
        .eq("is_active", true),
      supabaseAdmin.from("staff_groups").select("id,member_ids"),
    ]);
  const audiences = (audienceRows ?? []) as SurveyAudience[];
  const people = (staff ?? []) as ActiveStaff[];
  if (!audiences.length) return people.map((person) => person.id);
  const membersByGroup = new Map(
    ((groups ?? []) as StaffGroup[]).map((group) => [
      group.id,
      group.member_ids,
    ]),
  );
  const recipients = new Set<string>();
  for (const audience of audiences) {
    if (audience.audience_type === "staff" && audience.user_id)
      recipients.add(audience.user_id);
    if (audience.audience_type === "staff_group" && audience.staff_group_id)
      for (const userId of membersByGroup.get(audience.staff_group_id) ?? [])
        recipients.add(userId);
    if (audience.audience_type === "department" && audience.department)
      for (const person of people)
        if (person.department === audience.department)
          recipients.add(person.id);
    if (audience.audience_type === "manager_group" && audience.manager_id)
      for (const person of people)
        if (person.manager_id === audience.manager_id)
          recipients.add(person.id);
  }
  return [...recipients];
}

export async function isSurveyAudienceMember(
  surveyId: string,
  userId: string,
): Promise<boolean> {
  return (await audienceUserIds(surveyId)).includes(userId);
}
