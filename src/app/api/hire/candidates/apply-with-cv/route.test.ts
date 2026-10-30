import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertCanApply: vi.fn(),
  insertApplicant: vi.fn(),
  deleteApplicant: vi.fn(),
  notifyNewApplicant: vi.fn(),
  readCv: vi.fn(),
  attachCv: vi.fn(),
  sendApplicationConfirmation: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/candidate-applications", () => ({
  assertCanApply: mocks.assertCanApply,
  insertApplicant: mocks.insertApplicant,
  deleteApplicant: mocks.deleteApplicant,
  notifyNewApplicant: mocks.notifyNewApplicant,
}));
vi.mock("@/lib/candidate-cv", () => ({
  readCv: mocks.readCv,
  attachCv: mocks.attachCv,
}));
vi.mock("@/lib/application-emails", () => ({
  sendApplicationConfirmation: mocks.sendApplicationConfirmation,
}));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  rateLimitHeaders: () => ({}),
  requestIp: () => "127.0.0.1",
}));

const job = { title: "Business Development Intern" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.checkRateLimit.mockResolvedValue({ allowed: true });
  mocks.assertCanApply.mockResolvedValue(job);
  mocks.readCv.mockResolvedValue({
    bytes: Buffer.from("cv"),
    extension: "pdf",
    contentType: "application/pdf",
    text: "Curriculum vitae",
  });
  mocks.insertApplicant.mockResolvedValue("candidate-1");
  mocks.attachCv.mockResolvedValue({ queuedForScreening: true });
  mocks.sendApplicationConfirmation.mockResolvedValue(undefined);
  mocks.notifyNewApplicant.mockResolvedValue(undefined);
  mocks.deleteApplicant.mockResolvedValue(undefined);
});

function applicationRequest() {
  const form = new FormData();
  form.set("job_id", "job-1");
  form.set("full_name", "Amina Wanjiku");
  form.set("email", "amina@example.com");
  form.set("linkedin_url", "https://www.linkedin.com/in/amina-wanjiku");
  form.set("consented", "true");
  form.set("cv", new Blob(["cv"], { type: "application/pdf" }), "amina-cv.pdf");
  return new Request("http://localhost/api/hire/candidates/apply-with-cv", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/hire/candidates/apply-with-cv", () => {
  it("notifies recruiters only after the CV is stored", async () => {
    const { POST } = await import("./route");

    const response = await POST(applicationRequest());

    expect(response.status).toBe(200);
    expect(mocks.attachCv).toHaveBeenCalledWith(
      "candidate-1",
      "job-1",
      expect.anything(),
    );
    expect(mocks.notifyNewApplicant).toHaveBeenCalledWith(
      "candidate-1",
      { full_name: "Amina Wanjiku" },
      job,
    );
    expect(mocks.attachCv.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.notifyNewApplicant.mock.invocationCallOrder[0],
    );
  });

  it("rolls back a failed upload without notifying recruiters", async () => {
    mocks.attachCv.mockRejectedValueOnce(new Error("R2 upload failed"));
    const { POST } = await import("./route");

    const response = await POST(applicationRequest());

    expect(response.status).toBe(500);
    expect(mocks.deleteApplicant).toHaveBeenCalledWith("candidate-1");
    expect(mocks.notifyNewApplicant).not.toHaveBeenCalled();
    expect(mocks.sendApplicationConfirmation).not.toHaveBeenCalled();
  });
});
