import { describe, it, expect } from "vitest";
import { buildExportAttachment } from "./export-attachment";

const HEADERS = [
  { label: "Name", key: "name" },
  { label: "Email", key: "email" },
];

const DATA = [
  { name: "Alice", email: "alice@example.com" },
  { name: 'Bob "Bobby"', email: "bob,example@test.com" },
];

describe("buildExportAttachment – CSV", () => {
  it("produces a buffer with a header row", async () => {
    const result = await buildExportAttachment("csv", DATA, HEADERS, "test-export");
    expect(result.filename).toBe("test-export.csv");
    expect(result.contentType).toContain("text/csv");
    expect(result.content).toBeInstanceOf(Buffer);
    const text = result.content.toString("utf-8");
    expect(text.startsWith("Name,Email")).toBe(true);
  });

  it("RFC-quotes cells containing commas and double-quotes", async () => {
    const result = await buildExportAttachment("csv", DATA, HEADERS, "test-export");
    const text = result.content.toString("utf-8");
    // Bob's email contains a comma — must be quoted
    expect(text).toContain('"bob,example@test.com"');
    // Bob's name contains a double-quote — must be escaped
    expect(text).toContain('"Bob ""Bobby"""');
  });
});

describe("buildExportAttachment – XLSX", () => {
  it("produces a non-empty Buffer with the correct filename and content type", async () => {
    const result = await buildExportAttachment("xlsx", DATA, HEADERS, "test-export");
    expect(result.filename).toBe("test-export.xlsx");
    expect(result.contentType).toContain("spreadsheetml");
    expect(result.content).toBeInstanceOf(Buffer);
    expect(result.content.length).toBeGreaterThan(0);
  });
});

describe("buildExportAttachment – PDF", () => {
  it("produces a non-empty Buffer", async () => {
    const result = await buildExportAttachment("pdf", DATA, HEADERS, "test-export");
    expect(result.filename).toBe("test-export.pdf");
    expect(result.contentType).toBe("application/pdf");
    expect(result.content).toBeInstanceOf(Buffer);
    expect(result.content.length).toBeGreaterThan(0);
  });
});
