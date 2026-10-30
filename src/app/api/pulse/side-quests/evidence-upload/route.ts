import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File))
    return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type))
    return NextResponse.json(
      { error: "Upload a PDF, JPG, PNG, or WebP file." },
      { status: 400 },
    );
  if (file.size > MAX_BYTES)
    return NextResponse.json(
      { error: "Evidence must be 5 MB or smaller." },
      { status: 400 },
    );
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  try {
    const url = await uploadToR2(
      `side-quest-evidence/${session.user.id}/${randomUUID()}.${ext}`,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
    return NextResponse.json({ url, name: file.name });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed." },
      { status: 500 },
    );
  }
}
