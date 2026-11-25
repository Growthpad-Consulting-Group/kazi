import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";

describe("parseCsv", () => {
  it("reads quoted commas, escaped quotes and CRLF line endings", () => {
    const rows = parseCsv(
      'name,job_title\r\n"Wanjiku, Amina","Senior ""Lead"" Analyst"\r\nKevin,Intern\r\n',
    );
    expect(rows).toEqual([
      ["name", "job_title"],
      ["Wanjiku, Amina", 'Senior "Lead" Analyst'],
      ["Kevin", "Intern"],
    ]);
  });

  it("ignores a byte-order mark and blank lines", () => {
    const rows = parseCsv("﻿name,email\n\nAmina,amina@example.com\n");
    expect(rows).toEqual([
      ["name", "email"],
      ["Amina", "amina@example.com"],
    ]);
  });
});
