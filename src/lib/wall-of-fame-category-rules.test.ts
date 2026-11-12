import { describe, expect, it } from "vitest";
import {
  parseCriteria,
  validateCategoryInput,
} from "./wall-of-fame-category-rules";

describe("parseCriteria", () => {
  it("drops blank lines and trims", () => {
    expect(parseCriteria("  Strong results \n\n Teamwork  \n")).toEqual([
      "Strong results",
      "Teamwork",
    ]);
  });
});

describe("validateCategoryInput", () => {
  const base = {
    key: "client_win",
    label: "Client win",
    description: "",
    purpose: "",
    criteria: ["One"],
    icon: "solar:star-broken",
  };

  it("accepts a valid new category", () => {
    const result = validateCategoryInput(base, { isNew: true });
    expect(result.ok).toBe(true);
  });

  it("rejects a key that is not a stable identifier", () => {
    expect(
      validateCategoryInput({ ...base, key: "Client Win" }, { isNew: true }).ok,
    ).toBe(false);
    expect(
      validateCategoryInput({ ...base, key: "1st" }, { isNew: true }).ok,
    ).toBe(false);
  });

  it("ignores the key on update", () => {
    expect(
      validateCategoryInput({ ...base, key: "" }, { isNew: false }).ok,
    ).toBe(true);
  });

  it("limits criteria and rejects an invalid icon", () => {
    expect(
      validateCategoryInput(
        { ...base, criteria: ["a", "b", "c", "d", "e", "f", "g"] },
        { isNew: true },
      ).ok,
    ).toBe(false);
    expect(
      validateCategoryInput({ ...base, icon: "star" }, { isNew: true }).ok,
    ).toBe(false);
  });

  it("rejects an empty label", () => {
    expect(
      validateCategoryInput({ ...base, label: "  " }, { isNew: true }).ok,
    ).toBe(false);
  });
});
