"use server";

import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { invalidateTables } from "@/lib/cache/invalidate";

/** Updates the signed-in user's own name and email. */
export async function updateProfile(values: { name: string; email: string }) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  const name = values.name.trim();
  const email = values.email.trim().toLowerCase();
  if (!name) throw new Error("Name is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");

  const { data: clash } = await supabaseAdmin
    .from("users")
    .select("id")
    .ilike("email", email)
    .neq("id", session.user.id)
    .maybeSingle();
  if (clash) throw new Error("That email is already in use");

  const { error } = await supabaseAdmin
    .from("users")
    .update({ name, email })
    .eq("id", session.user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/profile");
  // The people directory and dashboard counts include this user's name.
  await invalidateTables("users");
  return { name, email };
}

/** Changes the signed-in user's own password. */
export async function changePassword(values: { current: string; next: string }) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("Unauthenticated");

  if (values.next.length < 8) throw new Error("New password must be at least 8 characters");
  if (values.next === values.current) throw new Error("New password must differ from the current one");

  const { data: user, error: findErr } = await supabaseAdmin
    .from("users")
    .select("password_hash")
    .eq("id", session.user.id)
    .single();
  if (findErr || !user) throw new Error("Account not found");

  const ok = await bcrypt.compare(values.current, user.password_hash);
  if (!ok) throw new Error("Current password is incorrect");

  const hash = await bcrypt.hash(values.next, 10);
  const { error } = await supabaseAdmin
    .from("users")
    .update({ password_hash: hash })
    .eq("id", session.user.id);
  if (error) throw new Error(error.message);

  return { ok: true };
}
