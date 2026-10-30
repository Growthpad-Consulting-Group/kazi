import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  extractCvText: vi.fn(),
}));

vi.mock("@/lib/cv-text", () => ({
  extractCvText: mocks.extractCvText,
}));
vi.mock("@/lib/ai", () => ({
  groq: {},
  GROQ_MODEL: "test-model",
}));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/redis", () => ({ redis: {}, SCREENING_QUEUE: "test" }));

describe("readCv", () => {
  it("keeps upload bytes intact when PDF extraction transfers its buffer", async () => {
    mocks.extractCvText.mockImplementation(
      async (_file: File, bytes: Uint8Array) => {
        structuredClone(bytes.buffer, { transfer: [bytes.buffer] });
        return "A readable CV with enough text to pass validation.";
      },
    );
    const { readCv } = await import("./candidate-cv");
    const source = new Uint8Array([1, 2, 3, 4]);
    const file = {
      name: "candidate.pdf",
      size: source.byteLength,
      type: "application/pdf",
      arrayBuffer: async () => source.buffer.slice(0),
    } as File;

    const result = await readCv(file);

    expect(result.bytes.byteLength).toBe(4);
    expect([...result.bytes]).toEqual([1, 2, 3, 4]);
  });
});
