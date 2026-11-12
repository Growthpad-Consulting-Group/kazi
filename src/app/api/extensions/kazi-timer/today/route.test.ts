import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  entries: [] as Record<string, unknown>[],
  upserted: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/browser-extension-auth", () => ({
  extensionCors: (_request: Request, response: Response) => response,
  extensionTokenUser: vi.fn(async () => ({ user_id: "u1" })),
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { entries: store.entries },
              error: null,
            }),
          }),
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        store.upserted = row;
        return { error: null };
      },
    }),
  },
}));

import { DELETE, GET } from "./route";

const today = new Date().toISOString().slice(0, 10);

function req(url: string, init?: RequestInit) {
  return new Request(
    `https://kazi.test/api/extensions/kazi-timer/today${url}`,
    init,
  );
}

beforeEach(() => {
  store.entries = [
    { task: "Client call", client: "Acme", category: "Meetings", minutes: 35 },
    { task: "Review", client: null, category: "Projects", minutes: 10 },
  ];
  store.upserted = null;
});

describe("extension today endpoint", () => {
  it("lists today's rows with their index", async () => {
    const body = await (await GET(req(`?date=${today}`))).json();
    expect(body.entries.map((entry: { index: number }) => entry.index)).toEqual(
      [0, 1],
    );
    expect(body.editable).toBe(true);
    expect(body.entries[0].mergeable).toBe(true);
  });

  it("deletes only the row the list showed", async () => {
    const response = await DELETE(
      req("", {
        method: "DELETE",
        body: JSON.stringify({ date: today, index: 1, task: "Review" }),
      }),
    );
    expect(response.status).toBe(200);
    expect(store.upserted?.entries).toEqual([store.entries[0]]);
  });

  it("refuses a stale row", async () => {
    const response = await DELETE(
      req("", {
        method: "DELETE",
        body: JSON.stringify({ date: today, index: 1, task: "Something else" }),
      }),
    );
    expect(response.status).toBe(409);
    expect(store.upserted).toBeNull();
  });

  it("refuses to change a locked day", async () => {
    const response = await DELETE(
      req("", {
        method: "DELETE",
        body: JSON.stringify({
          date: "2020-01-01",
          index: 0,
          task: "Client call",
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
});
