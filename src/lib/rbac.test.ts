import { describe, expect, it } from "vitest";
import { can, hasRole, userCan } from "@/lib/rbac";

describe("role permissions", () => {
  it("keeps hiring management away from employees and interviewers", () => {
    expect(can("employee", "manage_hiring")).toBe(false);
    expect(can("interviewer", "manage_hiring")).toBe(false);
    expect(can("hiring_manager", "manage_hiring")).toBe(true);
  });

  it("limits 1-on-1 management to leaders", () => {
    expect(can("employee", "manage_one_on_ones")).toBe(false);
    expect(can("interviewer", "manage_one_on_ones")).toBe(false);
    expect(can("manager", "manage_one_on_ones")).toBe(true);
    expect(can("hr", "manage_one_on_ones")).toBe(true);
    expect(can("admin", "manage_one_on_ones")).toBe(true);
  });

  it("does not treat role hierarchy as a permission grant", () => {
    expect(hasRole("admin", "employee")).toBe(true);
    expect(can("manager", "manage_surveys")).toBe(false);
  });

  it("honours an explicit extra permission without widening the role", () => {
    expect(
      userCan(
        { role: "employee", extraPermissions: ["manage_side_quests"] },
        "manage_side_quests",
      ),
    ).toBe(true);
    expect(
      userCan(
        { role: "employee", extraPermissions: ["manage_side_quests"] },
        "manage_hiring",
      ),
    ).toBe(false);
  });
});
