import { afterEach, describe, expect, it, vi } from "vitest";

const R2_ENV_KEYS = [
  "CLOUDFLARE_ACCOUNT_ID",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

function configureR2(
  overrides: Partial<Record<(typeof R2_ENV_KEYS)[number], string>> = {},
) {
  for (const key of R2_ENV_KEYS) vi.stubEnv(key, "");
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
}

describe("R2 storage configuration", () => {
  it("supports the legacy R2_ACCOUNT_ID name used by older deployments", async () => {
    configureR2({
      R2_ACCOUNT_ID: "legacy-account",
      R2_ACCESS_KEY_ID: "access-key",
      R2_SECRET_ACCESS_KEY: "secret-key",
      R2_BUCKET_NAME: "kazi-files",
    });

    const { r2 } = await import("./r2");
    const endpoint = await r2.config.endpoint!();

    expect(endpoint.hostname).toBe("legacy-account.r2.cloudflarestorage.com");
  });

  it("fails clearly before making a storage request when configuration is incomplete", async () => {
    configureR2();
    const { uploadToR2 } = await import("./r2");

    await expect(
      uploadToR2("cvs/example.pdf", Buffer.from("cv"), "application/pdf"),
    ).rejects.toThrow("R2 storage is not configured");
  });
});
