import { describe, expect, it } from "vitest";
import { sanitizeSignatureHtml } from "./sanitizeSignatureHtml";

describe("sanitizeSignatureHtml", () => {
  it("removes executable markup and event handlers", () => {
    const safe = sanitizeSignatureHtml(
      '<table><tr><td onclick="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">Unsafe</a></td></tr></table>',
    );
    expect(safe).not.toContain("script");
    expect(safe).not.toContain("onclick");
    expect(safe).not.toContain("javascript:");
  });

  it("keeps supported email markup and merge tags", () => {
    const safe = sanitizeSignatureHtml(
      '<table cellpadding="0"><tr><td style="color:#f05d23;font-size:13px"><img src="{{photo_url}}" width="48" alt="{{full_name}}"><a href="mailto:{{email}}">{{email}}</a></td></tr></table>',
    );
    expect(safe).toContain("{{photo_url}}");
    expect(safe).toContain("{{email}}");
    expect(safe).toContain("color:#f05d23");
  });
});
