import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabaseAdmin: {} }));

import { isAllowedExtensionRedirectUri } from "./browser-extension-auth";

const CHROME_ID = "dffnikiadlobakbogmmfjkobjieehcbc";

describe("isAllowedExtensionRedirectUri", () => {
  it("accepts the Chrome and Edge identity redirect for the Kazi Timer ID", () => {
    expect(
      isAllowedExtensionRedirectUri(
        `https://${CHROME_ID}.chromiumapp.org/kazi`,
      ),
    ).toBe(true);
  });

  it("accepts the Firefox identity redirect on the extensions domain", () => {
    expect(
      isAllowedExtensionRedirectUri(
        "https://6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.extensions.allizom.org/kazi",
      ),
    ).toBe(true);
  });

  it("rejects other extension IDs, other paths and other hosts", () => {
    expect(
      isAllowedExtensionRedirectUri(
        `https://${"a".repeat(32)}.chromiumapp.org/kazi`,
      ),
    ).toBe(false);
    expect(
      isAllowedExtensionRedirectUri(
        `https://${CHROME_ID}.chromiumapp.org/other`,
      ),
    ).toBe(false);
    expect(isAllowedExtensionRedirectUri("https://evil.example.com/kazi")).toBe(
      false,
    );
    expect(
      isAllowedExtensionRedirectUri(
        "https://6f1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d.extensions.allizom.org/kazi?x=1",
      ),
    ).toBe(false);
  });
});
