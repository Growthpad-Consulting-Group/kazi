import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// `R2_ACCOUNT_ID` was the original documented name. Keep accepting it so a
// deployed environment using that name does not turn into an `undefined` R2
// endpoint while configuration is being brought in line with the app.
const ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";

function assertR2Configured() {
  const missing = [
    !ACCOUNT_ID && "CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID)",
    !ACCESS_KEY_ID && "R2_ACCESS_KEY_ID",
    !SECRET_ACCESS_KEY && "R2_SECRET_ACCESS_KEY",
    !BUCKET && "R2_BUCKET_NAME",
  ].filter(Boolean);

  if (missing.length) {
    throw new Error(`R2 storage is not configured: ${missing.join(", ")}`);
  }
}

export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY_ID ?? "",
    secretAccessKey: SECRET_ACCESS_KEY ?? "",
  },
});

export async function uploadToR2(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  assertR2Configured();
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  // Return public URL if bucket has a public domain, otherwise a signed URL
  if (PUBLIC_URL) return `${PUBLIC_URL}/${key}`;
  return getSignedUrl(r2, new PutObjectCommand({ Bucket: BUCKET!, Key: key }), {
    expiresIn: 3600,
  });
}

export async function deleteFromR2(key: string): Promise<void> {
  assertR2Configured();
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET!, Key: key }));
}

export function r2PublicUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}
