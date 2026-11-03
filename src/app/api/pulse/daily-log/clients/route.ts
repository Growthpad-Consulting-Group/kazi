import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

const MAX_CLIENT_NAME = 100;

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function editDistance(left: string, right: string) {
  const previous = Array.from(
    { length: right.length + 1 },
    (_, index) => index,
  );
  for (let row = 1; row <= left.length; row += 1) {
    let diagonal = previous[0];
    previous[0] = row;
    for (let column = 1; column <= right.length; column += 1) {
      const saved = previous[column];
      previous[column] = Math.min(
        previous[column] + 1,
        previous[column - 1] + 1,
        diagonal + Number(left[row - 1] !== right[column - 1]),
      );
      diagonal = saved;
    }
  }
  return previous[right.length];
}

function isLikelyDuplicate(name: string, existing: string) {
  const normalized = normalizeName(name);
  const candidate = normalizeName(existing);
  if (normalized === candidate) return true;

  // Avoid treating short acronyms as duplicates. For actual client names, a
  // one- or two-character typo should not create a second canonical option.
  if (Math.min(normalized.length, candidate.length) < 6) return false;
  return (
    editDistance(normalized, candidate) /
      Math.max(normalized.length, candidate.length) <=
    0.2
  );
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await (supabaseAdmin as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    .from("daily_log_clients")
    .select("name")
    .order("name");
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    clients: ((data ?? []) as { name: string }[]).map((row) => row.name),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    name?: unknown;
  } | null;
  const name =
    typeof body?.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > MAX_CLIENT_NAME) {
    return NextResponse.json(
      { error: `Client names need 1 to ${MAX_CLIENT_NAME} characters` },
      { status: 400 },
    );
  }

  const db = supabaseAdmin as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  const { data: existingClients, error: existingError } = await db
    .from("daily_log_clients")
    .select("name")
    .order("name");
  if (existingError)
    return NextResponse.json({ error: existingError.message }, { status: 500 });

  const existing = ((existingClients ?? []) as { name: string }[]).find((row) =>
    isLikelyDuplicate(name, row.name),
  );
  if (existing) {
    if (normalizeName(existing.name) === normalizeName(name))
      return NextResponse.json({ name: existing.name });
    return NextResponse.json(
      {
        error: `A similar client already exists: ${existing.name}. Select it instead.`,
        name: existing.name,
      },
      { status: 409 },
    );
  }

  const { data, error } = await db
    .from("daily_log_clients")
    .insert({ name, created_by: session.user.id })
    .select("name")
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { name: (data as { name: string }).name },
    { status: 201 },
  );
}
