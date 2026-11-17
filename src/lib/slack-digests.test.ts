import { describe, expect, it } from "vitest";
import { buildNewApplicantsDigest } from "./slack-digests";

describe("buildNewApplicantsDigest", () => {
  it("lists applicants with score or awaiting-AI status and counts the rest", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => ({
      name: `Candidate ${i + 1}`,
      roleTitle: "Sales Executive",
      companyName: i === 0 ? undefined : "CCSA",
      score: i === 0 ? null : 60,
    }));
    const message = buildNewApplicantsDigest({
      firstName: "Amina",
      candidates,
      appUrl: "https://kazi.example",
    });

    expect(message.text).toBe(
      "Hi Amina — 10 new applications in the last 24 hours.",
    );
    const body = JSON.stringify(message.blocks);
    expect(body).toContain("Candidate 1* — Sales Executive · awaiting AI");
    expect(body).toContain(
      "Candidate 2* — Sales Executive · CCSA · AI score 60",
    );
    expect(body).toContain("+2 more");
    expect(body).toContain("https://kazi.example/hire/candidates");
  });

  it("uses the singular form for one application", () => {
    const message = buildNewApplicantsDigest({
      candidates: [{ name: "Tina", roleTitle: "CS", score: 70 }],
      appUrl: "https://kazi.example",
    });
    expect(message.text).toBe("1 new application in the last 24 hours.");
  });
});
