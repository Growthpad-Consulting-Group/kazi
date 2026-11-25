/* eslint-disable @typescript-eslint/no-explicit-any -- must_change_password and signature tables await generated types */
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";
import { canonicalDepartment } from "@/lib/departments";
import type { UserRole } from "@/types/database";

export const STAFF_ROLES: UserRole[] = [
  "admin",
  "hr",
  "hiring_manager",
  "manager",
  "interviewer",
  "employee",
];

export type NewStaffInput = {
  name: string;
  email: string;
  password: string;
  role?: string;
  department?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  managerId?: string | null;
  startDate?: string | null;
};

export type CreateStaffResult =
  | {
      ok: true;
      person: { id: string; name: string };
      signatureProfileCreated: boolean;
    }
  | { ok: false; status: number; error: string };

const trimmed = (value: string | null | undefined) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

function fail(status: number, error: string): CreateStaffResult {
  return { ok: false, status, error };
}

/**
 * Links the person to a Signature staff profile when their email is on a
 * configured company domain. An existing profile for the email is linked,
 * never duplicated. Returns whether a profile is linked to this account.
 */
export async function linkSignatureProfile(person: {
  id: string;
  email: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
}): Promise<{ linked: boolean; error?: string }> {
  const { data: domains, error: domainError } = await (supabaseAdmin as any)
    .from("signature_domains")
    .select("id, name");
  if (domainError) return { linked: false, error: domainError.message };
  const emailDomain = person.email.split("@")[1];
  const domain = ((domains ?? []) as { id: string; name: string }[]).find(
    (d) => d.name.toLowerCase() === emailDomain,
  );
  if (!domain) return { linked: false };

  const profiles = (supabaseAdmin as any).from("signature_staff_profiles");
  const { data: rows, error: lookupError } = await profiles
    .select("id, user_id")
    .eq("email", person.email);
  if (lookupError) return { linked: false, error: lookupError.message };
  const existing = (
    (rows ?? []) as { id: string; user_id: string | null }[]
  )[0];

  if (existing) {
    if (existing.user_id && existing.user_id !== person.id)
      return {
        linked: false,
        error: "This email's signature profile is linked to another account.",
      };
    const { error } = await profiles
      .update({ user_id: person.id })
      .eq("id", existing.id);
    return error ? { linked: false, error: error.message } : { linked: true };
  }

  const { error } = await profiles.insert({
    user_id: person.id,
    domain_id: domain.id,
    email: person.email,
    full_name: person.name,
    role_title: person.jobTitle,
    department: person.department,
    status: "active",
  });
  return error ? { linked: false, error: error.message } : { linked: true };
}

/**
 * Creates one staff account with the same rules for every entry point: the
 * single-person form and the CSV import.
 */
export async function createStaffMember(
  input: NewStaffInput,
  actorRole: UserRole,
): Promise<CreateStaffResult> {
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";
  const role = STAFF_ROLES.includes(input.role as UserRole)
    ? (input.role as UserRole)
    : "employee";

  if (!name || !email || !password)
    return fail(400, "Name, email, and temporary password are required.");
  if (!/^\S+@\S+\.\S+$/.test(email))
    return fail(400, "Enter a valid email address.");
  if (password.length < 8)
    return fail(400, "Temporary password must be at least 8 characters.");
  if (role === "admin" && actorRole !== "admin")
    return fail(403, "Only an administrator can create an admin account.");

  let department: string | null;
  try {
    department = await canonicalDepartment(input.department ?? null);
  } catch (cause) {
    return fail(
      400,
      cause instanceof Error ? cause.message : "Invalid department.",
    );
  }

  const { data: existing } = await supabaseAdmin
    .from("users")
    .select("id, is_active")
    .eq("email", email)
    .maybeSingle();
  if (existing?.is_active)
    return fail(409, "A staff member with this email already exists.");
  if (existing)
    return fail(
      409,
      "This email belongs to a deactivated account. Reactivate it from its profile instead.",
    );

  const passwordHash = await bcrypt.hash(password, 10);
  const jobTitle = trimmed(input.jobTitle);
  const { data, error } = await (supabaseAdmin as any)
    .from("users")
    .insert({
      name,
      email,
      password_hash: passwordHash,
      must_change_password: true,
      role,
      department,
      job_title: jobTitle,
      location: trimmed(input.location),
      manager_id: trimmed(input.managerId),
      start_date: trimmed(input.startDate),
      is_active: true,
    })
    .select("id, name")
    .single();
  if (error) return fail(500, error.message);

  const signature = await linkSignatureProfile({
    id: data.id,
    email,
    name,
    jobTitle,
    department,
  });
  await invalidateTables("users");
  if (signature.error)
    return fail(
      500,
      `Staff account was created, but its signature profile could not be linked: ${signature.error}`,
    );
  return {
    ok: true,
    person: { id: data.id, name: data.name },
    signatureProfileCreated: signature.linked,
  };
}
