import { beforeEach, describe, expect, it, vi } from "vitest";

// An in-memory stand-in for the three tables the timer API touches.
const store = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    shared_active_timers: [],
    shared_timer_stops: [],
    daily_activity_logs: [],
  };
  const keyOf: Record<string, string[]> = {
    shared_active_timers: ["user_id"],
    shared_timer_stops: ["user_id", "timer_id"],
    daily_activity_logs: ["user_id", "log_date"],
  };
  const sameKey = (table: string, a: Row, b: Row) =>
    keyOf[table].every((key) => a[key] === b[key]);

  function builder(table: string) {
    const filters: Row = {};
    const rows = () =>
      tables[table].filter((row) =>
        Object.entries(filters).every(([key, value]) => row[key] === value),
      );
    const api = {
      select: () => api,
      eq(key: string, value: unknown) {
        filters[key] = value;
        return api;
      },
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      then(resolve: (value: unknown) => void) {
        resolve({ data: rows(), error: null });
      },
      update(patch: Row) {
        return {
          eq(key: string, value: unknown) {
            filters[key] = value;
            return {
              eq(key2: string, value2: unknown) {
                const matches = tables[table].filter(
                  (row) => row[key] === value && row[key2] === value2,
                );
                matches.forEach((row) => Object.assign(row, patch));
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
      insert(row: Row) {
        const existing = tables[table].find((item) =>
          sameKey(table, item, row),
        );
        if (existing) return Promise.resolve({ error: { code: "23505" } });
        tables[table].push({ ...row });
        return Promise.resolve({ error: null });
      },
      upsert(row: Row) {
        const index = tables[table].findIndex((item) =>
          sameKey(table, item, row),
        );
        if (index >= 0) Object.assign(tables[table][index], row);
        else tables[table].push({ ...row });
        return Promise.resolve({ error: null });
      },
      delete() {
        return {
          eq(key: string, value: unknown) {
            filters[key] = value;
            return {
              eq(key2: string, value2: unknown) {
                tables[table] = tables[table].filter(
                  (row) => !(row[key] === value && row[key2] === value2),
                );
                return Promise.resolve({ error: null });
              },
            };
          },
        };
      },
    };
    return api;
  }

  return {
    tables,
    from: vi.fn((table: string) => builder(table)),
    getServerSession: vi.fn(),
    awardDailyLogRewards: vi.fn(),
  };
});

vi.mock("next-auth", () => ({ getServerSession: store.getServerSession }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: { from: store.from } }));
vi.mock("@/lib/browser-extension-auth", () => ({
  extensionCors: (_request: Request, response: Response) => response,
  extensionTokenUser: vi.fn(async () => null),
}));
vi.mock("@/features/pulse/daily-log/rewards", () => ({
  awardDailyLogRewards: store.awardDailyLogRewards,
}));

import { POST, PUT, GET } from "./route";

const USER = "00000000-0000-4000-8000-000000000001";
const TIMER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const today = new Date().toISOString().slice(0, 10);

function request(method: string, body?: unknown) {
  return new Request("https://kazi.test/api/pulse/daily-log/timer", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function timer(overrides: Record<string, unknown> = {}) {
  return {
    id: TIMER_ID,
    logDate: today,
    task: "Client call",
    client: "Acme",
    category: "Meetings",
    startedAt: new Date(Date.now() - 30 * 60_000).toISOString(),
    accumulatedMs: 0,
    running: true,
    source: "kazi",
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  for (const key of Object.keys(store.tables)) store.tables[key].length = 0;
  store.getServerSession.mockResolvedValue({ user: { id: USER } });
  store.awardDailyLogRewards.mockResolvedValue(undefined);
});

describe("shared timer API", () => {
  it("rejects a second timer while one is active", async () => {
    await PUT(request("PUT", { timer: timer() }));
    const response = await PUT(
      request("PUT", { timer: timer({ id: OTHER_ID }) }),
    );
    expect(response.status).toBe(409);
  });

  it("stop writes exactly one daily-log entry and clears the timer", async () => {
    await PUT(request("PUT", { timer: timer() }));
    const response = await POST(
      request("POST", {
        action: "stop",
        timerId: TIMER_ID,
        at: new Date().toISOString(),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.entry).toMatchObject({ task: "Client call", minutes: 30 });
    expect(store.tables.daily_activity_logs[0].entries).toHaveLength(1);
    expect(store.tables.shared_active_timers).toHaveLength(0);
  });

  it("a repeated stop returns the stored entry without writing again", async () => {
    await PUT(request("PUT", { timer: timer() }));
    await POST(request("POST", { action: "stop", timerId: TIMER_ID }));
    const again = await POST(
      request("POST", { action: "stop", timerId: TIMER_ID }),
    );
    const body = await again.json();

    expect(body.duplicate).toBe(true);
    expect(store.tables.daily_activity_logs[0].entries).toHaveLength(1);
  });

  it("concurrent stops from two tabs write one entry", async () => {
    await PUT(request("PUT", { timer: timer() }));
    const [first, second] = await Promise.all([
      POST(request("POST", { action: "stop", timerId: TIMER_ID })),
      POST(request("POST", { action: "stop", timerId: TIMER_ID })),
    ]);

    expect(
      [first.status, second.status].every((status) => status === 200),
    ).toBe(true);
    expect(store.tables.daily_activity_logs[0].entries).toHaveLength(1);
  });

  it("pause and resume keep elapsed time on the server", async () => {
    await PUT(
      request("PUT", {
        timer: timer({ startedAt: null, running: false, accumulatedMs: 0 }),
      }),
    );
    const resumed = await (
      await POST(request("POST", { action: "resume", timerId: TIMER_ID }))
    ).json();
    expect(resumed.timer.running).toBe(true);

    const paused = await (
      await POST(request("POST", { action: "pause", timerId: TIMER_ID }))
    ).json();
    expect(paused.timer.running).toBe(false);
    expect(paused.timer.accumulatedMs).toBeGreaterThanOrEqual(0);

    const read = await (await GET(request("GET"))).json();
    expect(read.timer.running).toBe(false);
  });

  it("does not let a client stop time that has not elapsed", async () => {
    const startedAt = new Date().toISOString();
    await PUT(request("PUT", { timer: timer({ startedAt }) }));
    const response = await POST(
      request("POST", {
        action: "stop",
        timerId: TIMER_ID,
        at: new Date(Date.now() + 10 * 3_600_000).toISOString(),
      }),
    );
    const body = await response.json();
    expect(body.entry.minutes).toBe(1);
  });

  it("resending a started timer with the same id is idempotent", async () => {
    await PUT(request("PUT", { timer: timer() }));
    const again = await PUT(request("PUT", { timer: timer() }));
    expect(again.status).toBe(200);
    expect(store.tables.shared_active_timers).toHaveLength(1);
  });
});
