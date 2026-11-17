import { describe, expect, it } from "vitest";
import { buildNewApplicantsDigest } from "./slack-digests";

describe("buildNewApplicantsDigest", () => {
  it("groups applicants by company with a count for each group", () => {
    const candidates = [
      ...Array.from({ length: 9 }, (_, i) => ({
        name: `Candidate ${i + 1}`,
        roleTitle: "Sales Executive",
        companyName: "CCSA",
        score: 60,
      })),
      {
        name: "Tina Raga",
        roleTitle: "Customer Service",
        companyName: "Growthpad",
        score: null,
      },
    ];
    const message = buildNewApplicantsDigest({
      firstName: "Amina",
      candidates,
      appUrl: "https://kazi.example",
    });

    expect(message.text).toBe(
      "Hi Amina — 10 new applications in the last 24 hours.",
    );
    const body = JSON.stringify(message.blocks);
    expect(body).toContain("*CCSA 9 applicants*");
    expect(body).toContain("*Growthpad 1 applicant*");
    expect(body).toContain("• *Tina Raga* — Customer Service · awaiting AI");
    expect(body).toContain("• +1 more");
    expect(body).toContain("https://kazi.example/hire/candidates");
  });

  it("uses singular wording for one application", () => {
    const message = buildNewApplicantsDigest({
      candidates: [
        { name: "Tina", roleTitle: "CS", companyName: "CCSA", score: 70 },
      ],
      appUrl: "https://kazi.example",
    });
    expect(message.text).toBe("1 new application in the last 24 hours.");
    expect(JSON.stringify(message.blocks)).toContain("*CCSA 1 applicant*");
  });
});
