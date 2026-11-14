import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock supabaseAdmin so tests run without a live database.
vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

import { supabaseAdmin } from "@/lib/supabase";
import {
  assertHireCompanyAccess,
  assertHireCandidateAccess,
  assertHireCandidateBatchAccess,
} from "./hire-company-access";

const GROWTHPAD_ID = "11111111-0000-0000-0000-000000000001";
const CCSA_ID = "22222222-0000-0000-0000-000000000002";
const ALICE_ID = "aaaaaaaa-0000-0000-0000-000000000001"; // recruiter in Growthpad only
const BOB_ID = "bbbbbbbb-0000-0000-0000-000000000001"; // company_admin in CCSA only
const ASENATH_ID = "cccccccc-0000-0000-0000-000000000001"; // recruiter in both

type MockQueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
};

function makeChain(result: unknown): MockQueryBuilder {
  const chain: MockQueryBuilder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("assertHireCompanyAccess — membership-based access", () => {
  it("grants access when the user has an active membership for the company", async () => {
    // For non-admin role the helper queries company_memberships using chained .eq().
    // The last .eq() in the chain must return the resolved data.
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "company_memberships") {
        const membershipData = {
          data: [
            {
              hire_role: "recruiter",
              companies: {
                id: GROWTHPAD_ID,
                slug: "growthpad",
                display_name: "Growthpad",
                is_active: true,
              },
            },
          ],
          error: null,
        };
        const chain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn(),
        };
        // Chain three .eq() calls; the third resolves.
        chain.eq
          .mockReturnValueOnce(chain)
          .mockReturnValueOnce(chain)
          .mockResolvedValueOnce(membershipData);
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeChain(null) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    const result = await assertHireCompanyAccess({
      userId: ALICE_ID,
      userRole: "hiring_manager",
      companyId: GROWTHPAD_ID,
    });
    expect(result.companyId).toBe(GROWTHPAD_ID);
    expect(result.role).toBe("recruiter");
  });

  it("throws Forbidden when the user has no membership for the requested company", async () => {
    // Alice only has Growthpad membership, not CCSA.
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "company_memberships") {
        const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn() };
        chain.eq
          .mockReturnValueOnce(chain)
          .mockReturnValueOnce(chain)
          .mockResolvedValueOnce({
            data: [
              {
                hire_role: "recruiter",
                companies: {
                  id: GROWTHPAD_ID,
                  slug: "growthpad",
                  display_name: "Growthpad",
                  is_active: true,
                },
              },
            ],
            error: null,
          });
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeChain(null) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      assertHireCompanyAccess({
        userId: ALICE_ID,
        userRole: "hiring_manager",
        companyId: CCSA_ID,
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when the user's role is below the minimum required", async () => {
    // Bob is a viewer — requesting company_admin minimum.
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "company_memberships") {
        const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn() };
        chain.eq
          .mockReturnValueOnce(chain)
          .mockReturnValueOnce(chain)
          .mockResolvedValueOnce({
            data: [
              {
                hire_role: "viewer",
                companies: {
                  id: CCSA_ID,
                  slug: "ccsa",
                  display_name: "CCSA",
                  is_active: true,
                },
              },
            ],
            error: null,
          });
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeChain(null) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      assertHireCompanyAccess({
        userId: BOB_ID,
        userRole: "hiring_manager",
        companyId: CCSA_ID,
        minimumRole: "company_admin",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("global admin/HR can access any company without a membership row", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "companies") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({
            data: [
              { id: GROWTHPAD_ID, slug: "growthpad", display_name: "Growthpad" },
              { id: CCSA_ID, slug: "ccsa", display_name: "CCSA" },
            ],
            error: null,
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeChain(null) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    // As admin, should be allowed for CCSA even without membership.
    const result = await assertHireCompanyAccess({
      userId: ASENATH_ID,
      userRole: "admin",
      companyId: CCSA_ID,
    });
    expect(result.role).toBe("global_admin");
    expect(result.companyId).toBe(CCSA_ID);
  });
});

describe("assertHireCandidateAccess — cross-company isolation", () => {
  it("throws Forbidden when candidate belongs to a different company", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "candidates") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { company_id: CCSA_ID },
            error: null,
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "company_memberships") {
        // Alice only has Growthpad access.
        const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn() };
        chain.eq
          .mockReturnValueOnce(chain)
          .mockReturnValueOnce(chain)
          .mockResolvedValueOnce({
            data: [
              {
                hire_role: "recruiter",
                companies: {
                  id: GROWTHPAD_ID,
                  slug: "growthpad",
                  display_name: "Growthpad",
                  is_active: true,
                },
              },
            ],
            error: null,
          });
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeChain(null) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      assertHireCandidateAccess({
        candidateId: "cand-ccsa-001",
        userId: ALICE_ID,
        userRole: "hiring_manager",
      }),
    ).rejects.toThrow("Forbidden");
  });
});

describe("assertHireCandidateBatchAccess — mixed company batch", () => {
  it("throws Forbidden for a batch that spans two companies when user has access to only one", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "candidates") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: "cand-1", company_id: GROWTHPAD_ID },
              { id: "cand-2", company_id: CCSA_ID },
            ],
            error: null,
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "company_memberships") {
        // Alice only has Growthpad — called once per unique company_id in batch.
        const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn() };
        chain.eq
          .mockReturnValueOnce(chain)
          .mockReturnValueOnce(chain)
          .mockResolvedValue({
            data: [
              {
                hire_role: "recruiter",
                companies: {
                  id: GROWTHPAD_ID,
                  slug: "growthpad",
                  display_name: "Growthpad",
                  is_active: true,
                },
              },
            ],
            error: null,
          });
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeChain(null) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    await expect(
      assertHireCandidateBatchAccess({
        candidateIds: ["cand-1", "cand-2"],
        userId: ALICE_ID,
        userRole: "hiring_manager",
      }),
    ).rejects.toThrow("Forbidden");
  });

  it("allows a batch where all candidates belong to a company the user can access", async () => {
    vi.mocked(supabaseAdmin.from).mockImplementation((table: string) => {
      if (table === "candidates") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({
            data: [
              { id: "cand-1", company_id: GROWTHPAD_ID },
              { id: "cand-3", company_id: GROWTHPAD_ID },
            ],
            error: null,
          }),
        } as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      if (table === "company_memberships") {
        const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn() };
        chain.eq
          .mockReturnValueOnce(chain)
          .mockReturnValueOnce(chain)
          .mockResolvedValueOnce({
            data: [
              {
                hire_role: "recruiter",
                companies: {
                  id: GROWTHPAD_ID,
                  slug: "growthpad",
                  display_name: "Growthpad",
                  is_active: true,
                },
              },
            ],
            error: null,
          });
        return chain as unknown as ReturnType<typeof supabaseAdmin.from>;
      }
      return makeChain(null) as unknown as ReturnType<typeof supabaseAdmin.from>;
    });

    const results = await assertHireCandidateBatchAccess({
      candidateIds: ["cand-1", "cand-3"],
      userId: ALICE_ID,
      userRole: "hiring_manager",
    });
    expect(results).toHaveLength(1);
    expect(results[0].companyId).toBe(GROWTHPAD_ID);
  });
});
