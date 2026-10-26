import { createHmac, timingSafeEqual } from "node:crypto";

const MAX_AGE_MS = 30 * 60 * 1000;

function signingSecret() {
  return process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET ?? "";
}

function signature(candidateId: string, jobId: string, expiresAt: string) {
  return createHmac("sha256", signingSecret())
    .update(`${candidateId}:${jobId}:${expiresAt}`)
    .digest("base64url");
}

/** A short-lived token lets an applicant upload their CV immediately after applying. */
export function createCandidateUploadToken(candidateId: string, jobId: string) {
  const expiresAt = String(Date.now() + MAX_AGE_MS);
  return `${expiresAt}.${signature(candidateId, jobId, expiresAt)}`;
}

export function verifyCandidateUploadToken(token: string | null, candidateId: string, jobId: string) {
  if (!token || !signingSecret()) return false;
  const [expiresAt, provided] = token.split(".");
  if (!expiresAt || !provided || Number(expiresAt) < Date.now()) return false;

  const expected = signature(candidateId, jobId, expiresAt);
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}
