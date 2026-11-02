import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listeners = {};
let local;
let session;
let chromeMock;

function event(name) {
  return {
    addListener(listener) {
      listeners[name] = listener;
    },
  };
}

function storage(area) {
  return {
    async get(keys) {
      const names = Array.isArray(keys) ? keys : [keys];
      return Object.fromEntries(names.map((key) => [key, area[key]]));
    },
    async set(values) {
      Object.assign(area, values);
    },
    async remove(key) {
      delete area[key];
    },
  };
}

async function loadWorker() {
  vi.resetModules();
  await import("./background.js");
}

function message(payload) {
  return new Promise((resolve) => {
    listeners.message(payload, {}, resolve);
  });
}

beforeEach(() => {
  Object.keys(listeners).forEach((key) => delete listeners[key]);
  local = {};
  session = {};
  chromeMock = {
    storage: {
      local: storage(local),
      session: storage(session),
      onChanged: event("storageChanged"),
    },
    runtime: {
      onInstalled: event("installed"),
      onStartup: event("startup"),
      onMessage: event("message"),
    },
    alarms: {
      create: vi.fn().mockResolvedValue(undefined),
      onAlarm: event("alarm"),
    },
    tabs: {
      query: vi.fn(async () => []),
      onUpdated: event("tabUpdated"),
    },
    scripting: { executeScript: vi.fn(async () => []) },
    action: {
      setBadgeText: vi.fn().mockResolvedValue(undefined),
      setBadgeBackgroundColor: vi.fn().mockResolvedValue(undefined),
      setBadgeTextColor: vi.fn().mockResolvedValue(undefined),
      setTitle: vi.fn().mockResolvedValue(undefined),
    },
  };
  globalThis.chrome = chromeMock;
  globalThis.fetch = vi.fn().mockResolvedValue({ ok: true });
  vi.spyOn(Date, "now").mockReturnValue(1_000_000);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Kazi Timer background worker", () => {
  it("creates its recovery alarm and restores the persisted timer badge on install", async () => {
    local.timer = {
      task: "Prepare proposal",
      elapsedMs: 5 * 60_000,
      startedAt: 940_000,
      running: true,
    };
    await loadWorker();

    await listeners.installed();

    expect(chromeMock.alarms.create).toHaveBeenCalledWith("kazi-timer-tick", {
      periodInMinutes: 0.5,
    });
    expect(chromeMock.action.setBadgeText).toHaveBeenLastCalledWith({
      text: "6m",
    });
  });

  it("keeps queued work after restart while restoring a running timer", async () => {
    local.timer = {
      task: "Client follow-up",
      elapsedMs: 60_000,
      startedAt: 880_000,
      running: true,
    };
    local.completedEntries = [{ id: "queued-entry" }];
    await loadWorker();

    await listeners.startup();
    const state = await message({ type: "get-state" });

    expect(state.elapsedSeconds).toBe(180);
    expect(state.queued).toBe(1);
    expect(state.connected).toBe(false);
    expect(chromeMock.action.setBadgeText).toHaveBeenLastCalledWith({
      text: "3m",
    });
  });

  it("recalculates elapsed time after sleep/wake without double-counting", async () => {
    local.timer = {
      task: "Write report",
      elapsedMs: 120_000,
      startedAt: 700_000,
      running: true,
    };
    await loadWorker();

    await listeners.alarm({ name: "kazi-timer-tick" });
    const state = await message({ type: "get-state" });

    expect(state.elapsedSeconds).toBe(420);
    expect(chromeMock.action.setBadgeText).toHaveBeenLastCalledWith({
      text: "7m",
    });
  });

  it("revokes the extension session on sign-out but preserves unsynced work", async () => {
    session.kaziAccessToken = "revocable-token";
    local.completedEntries = [{ id: "queued-entry" }];
    await loadWorker();

    expect(await message({ type: "disconnect" })).toEqual({ connected: false });
    expect(session.kaziAccessToken).toBeUndefined();
    expect(local.completedEntries).toEqual([{ id: "queued-entry" }]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://kazi.growthpad.africa/api/extensions/kazi-timer/entries",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("serializes concurrent starts so only one timer can become active", async () => {
    await loadWorker();

    const [first, second] = await Promise.all([
      message({ type: "start", task: "First task", category: "Projects" }),
      message({ type: "start", task: "Second task", category: "Projects" }),
    ]);

    expect(first.timer.task).toBe("First task");
    expect(second).toEqual({ error: "A timer is already active" });
    expect(local.timer.task).toBe("First task");
  });
});

const SHARED_URL = "https://kazi.growthpad.africa/api/pulse/daily-log/timer";
const TIMER_ID = "11111111-1111-4111-8111-111111111111";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

// A tiny stand-in for the Kazi timer API: one timer per user, stop idempotent.
function fakeKazi() {
  const state = { timer: null, stops: new Map(), calls: [] };
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    state.calls.push({ url, method: init.method || "GET", body });
    if (url !== SHARED_URL) return { ok: true, status: 200 };
    if (init.method === "GET") return jsonResponse(200, { timer: state.timer });
    if (init.method === "PUT") {
      if (state.stops.has(body.timer.id))
        return jsonResponse(409, { error: "This timer was already stopped" });
      if (state.timer && state.timer.id !== body.timer.id)
        return jsonResponse(409, {
          error: "A timer is already active",
          timer: state.timer,
        });
      state.timer = body.timer;
      return jsonResponse(200, { timer: body.timer });
    }
    if (body.action === "stop") {
      if (state.stops.has(body.timerId))
        return jsonResponse(200, {
          entry: state.stops.get(body.timerId),
          timer: null,
          duplicate: true,
        });
      if (!state.timer || state.timer.id !== body.timerId)
        return jsonResponse(404, { error: "No active timer" });
      const entry = { task: state.timer.task, minutes: 1 };
      state.stops.set(body.timerId, entry);
      state.timer = null;
      return jsonResponse(200, { entry, timer: null });
    }
    if (body.action === "pause" || body.action === "resume") {
      if (!state.timer) return jsonResponse(404, { error: "No active timer" });
      state.timer = { ...state.timer, running: body.action === "resume" };
      return jsonResponse(200, { timer: state.timer });
    }
    return jsonResponse(400, { error: "bad" });
  });
  return state;
}

describe("Kazi Timer shared timer flow", () => {
  it("starts a timer on Kazi and mirrors it locally", async () => {
    session.kaziAccessToken = "token";
    const kazi = fakeKazi();
    await loadWorker();

    const started = await message({
      type: "start",
      task: "Client call",
      category: "Meetings",
    });

    expect(started.timer.task).toBe("Client call");
    expect(kazi.timer.id).toBe(started.timer.id);
    expect(local.timer.id).toBe(started.timer.id);
  });

  it("continues a logged row from its total when resumed", async () => {
    session.kaziAccessToken = "token";
    const kazi = fakeKazi();
    await loadWorker();

    const resumed = await message({
      type: "start",
      task: "Expose LinkedIn",
      category: "Projects",
      baseMinutes: 35,
    });

    expect(resumed.timer.accumulatedMs).toBe(35 * 60_000);
    expect(resumed.timer.baseMs).toBe(35 * 60_000);
    expect(kazi.timer.baseMs).toBe(35 * 60_000);
  });

  it("sends stop to the shared endpoint and clears the local timer", async () => {
    session.kaziAccessToken = "token";
    const kazi = fakeKazi();
    await loadWorker();
    const started = await message({
      type: "start",
      task: "Review",
      category: "Projects",
    });

    const stopped = await message({ type: "stop" });

    expect(stopped.entry.id).toBe(started.timer.id);
    expect(stopped.queued).toBe(0);
    expect(kazi.stops.has(started.timer.id)).toBe(true);
    expect(kazi.timer).toBeNull();
    expect(local.timer).toBeNull();
    expect(local.completedEntries).toEqual([]);
  });

  it("keeps the stop queued offline and syncs it once Kazi is reachable", async () => {
    session.kaziAccessToken = "token";
    const kazi = fakeKazi();
    await loadWorker();
    const started = await message({
      type: "start",
      task: "Offline work",
      category: "Admin",
    });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error("offline"));
    const offline = await message({ type: "stop" });
    expect(offline.queued).toBe(1);
    expect(local.timer).toBeNull();

    fakeKazi();
    await listeners.alarm({ name: "kazi-timer-tick" });

    expect(local.completedEntries).toEqual([]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      SHARED_URL,
      expect.objectContaining({ method: "PUT" }),
    );
    expect(started.timer.id).toBeTruthy();
  });

  it("does not log a timer twice when a stop is retried", async () => {
    session.kaziAccessToken = "token";
    const kazi = fakeKazi();
    await loadWorker();
    const started = await message({
      type: "start",
      task: "Retry",
      category: "Other",
    });
    await message({ type: "stop" });

    local.completedEntries = [
      {
        type: "stop",
        id: started.timer.id,
        timer: started.timer,
        at: new Date().toISOString(),
      },
    ];
    await listeners.alarm({ name: "kazi-timer-tick" });

    expect(kazi.stops.size).toBe(1);
    expect(local.completedEntries).toEqual([]);
  });

  it("reflects a pause made in Kazi when the worker refreshes", async () => {
    session.kaziAccessToken = "token";
    const kazi = fakeKazi();
    await loadWorker();
    const started = await message({
      type: "start",
      task: "Shared",
      category: "Projects",
    });
    kazi.timer = {
      ...kazi.timer,
      running: false,
      startedAt: null,
      accumulatedMs: 120_000,
    };

    const state = await message({ type: "get-state" });

    expect(state.timer.id).toBe(started.timer.id);
    expect(state.timer.running).toBe(false);
    expect(state.elapsedSeconds).toBe(120);
  });

  it("hides a timer whose offline stop has not synced yet", async () => {
    session.kaziAccessToken = "token";
    const kazi = fakeKazi();
    await loadWorker();
    const started = await message({
      type: "start",
      task: "Stale",
      category: "Projects",
    });
    local.completedEntries = [
      {
        type: "stop",
        id: started.timer.id,
        timer: started.timer,
        at: new Date().toISOString(),
      },
    ];
    kazi.stops.clear();

    const state = await message({ type: "get-state" });

    expect(state.timer).toBeNull();
  });

  it("converts legacy local timers to the shared shape", async () => {
    local.timer = {
      task: "Legacy",
      elapsedMs: 60_000,
      startedAt: 940_000,
      running: true,
      source: "extension",
    };
    await loadWorker();

    const state = await message({ type: "get-state" });

    expect(state.timer.accumulatedMs).toBe(60_000);
    expect(state.timer.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(local.timer.accumulatedMs).toBe(60_000);
  });
});

describe("Kazi Timer floating timer opt-in", () => {
  const ASANA = "https://app.asana.com";
  let injected;

  beforeEach(() => {
    injected = [];
    chromeMock.tabs = {
      query: vi.fn(async () => [
        { id: 7, url: `${ASANA}/0/123/list` },
        { id: 8, url: "https://example.com/page" },
      ]),
      onUpdated: event("tabUpdated"),
    };
    chromeMock.scripting = {
      executeScript: vi.fn(async ({ target }) => {
        injected.push(target.tabId);
      }),
    };
  });

  it("is off by default and injects nothing on navigation", async () => {
    await loadWorker();
    await listeners.tabUpdated(
      7,
      { status: "complete" },
      { url: `${ASANA}/0/123` },
    );
    expect(chromeMock.scripting.executeScript).not.toHaveBeenCalled();
  });

  it("injects into open tabs of a site once it is chosen", async () => {
    await loadWorker();
    await message({ type: "mini-set-enabled", enabled: true });

    const state = await message({
      type: "mini-set-site",
      origin: ASANA,
      enabled: true,
    });

    expect(state.sites).toEqual([ASANA]);
    expect(injected).toEqual([7]);
  });

  it("injects on navigation only for chosen sites while enabled", async () => {
    await loadWorker();
    await message({ type: "mini-set-enabled", enabled: true });
    await message({ type: "mini-set-site", origin: ASANA, enabled: true });
    injected.length = 0;

    await listeners.tabUpdated(
      8,
      { status: "complete" },
      { url: "https://example.com/page" },
    );
    await listeners.tabUpdated(
      7,
      { status: "loading" },
      { url: `${ASANA}/0/123` },
    );
    await listeners.tabUpdated(
      7,
      { status: "complete" },
      { url: `${ASANA}/0/123` },
    );

    expect(injected).toEqual([7]);
  });

  it("stops injecting when the site is removed or the opt-in is turned off", async () => {
    await loadWorker();
    await message({ type: "mini-set-enabled", enabled: true });
    await message({ type: "mini-set-site", origin: ASANA, enabled: true });
    await message({ type: "mini-set-site", origin: ASANA, enabled: false });
    injected.length = 0;

    await listeners.tabUpdated(
      7,
      { status: "complete" },
      { url: `${ASANA}/0/123` },
    );
    expect(injected).toEqual([]);

    await message({ type: "mini-set-site", origin: ASANA, enabled: true });
    await message({ type: "mini-set-enabled", enabled: false });
    injected.length = 0;
    await listeners.tabUpdated(
      7,
      { status: "complete" },
      { url: `${ASANA}/0/123` },
    );
    expect(injected).toEqual([]);
  });
});

describe("Kazi Timer Asana task link", () => {
  it("remembers the Asana task link for a timer started from Asana, locally only", async () => {
    await loadWorker();
    const started = await message({
      type: "start",
      task: "Client requested changes",
      category: "Projects",
      sourceUrl: "https://app.asana.com/1/1/project/2/task/3",
    });

    expect(local.timerSources).toEqual({
      [started.timer.id]: "https://app.asana.com/1/1/project/2/task/3",
    });
  });

  it("ignores a link that is not an Asana task", async () => {
    await loadWorker();
    await message({
      type: "start",
      task: "Other",
      category: "Projects",
      sourceUrl: "https://example.com/evil",
    });
    expect(local.timerSources).toBeUndefined();
  });
});

describe("Kazi Timer automatic reconnect", () => {
  beforeEach(() => {
    chromeMock.identity = {
      getRedirectURL: vi.fn(() => "https://ext.chromiumapp.org/kazi"),
      launchWebAuthFlow: vi.fn(async ({ url }) => {
        const state =
          new URL(url).searchParams.get("redirect_uri") &&
          new URL(url).searchParams.get("state");
        return `https://ext.chromiumapp.org/kazi#access_token=fresh-token&state=${state}`;
      }),
    };
  });

  it("reconnects silently on startup when the staff member is still signed in", async () => {
    await loadWorker();
    await listeners.startup();

    expect(chromeMock.identity.launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: false }),
    );
    expect(session.kaziAccessToken).toBe("fresh-token");
  });

  it("does not open a window again within the retry interval", async () => {
    chromeMock.identity.launchWebAuthFlow.mockRejectedValue(
      new Error("Interaction required"),
    );
    await loadWorker();
    await listeners.alarm({ name: "kazi-timer-tick" });
    await listeners.alarm({ name: "kazi-timer-tick" });

    expect(chromeMock.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
  });

  it("forgets the token when Kazi rejects it, so the next tick reconnects", async () => {
    session.kaziAccessToken = "expired-token";
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({}),
    }));
    await loadWorker();

    await message({ type: "start", task: "Expired", category: "Projects" });

    expect(session.kaziAccessToken).toBeUndefined();
  });

  it("does not reconnect after the staff member clicks Disconnect", async () => {
    session.kaziAccessToken = "revocable-token";
    await loadWorker();
    await message({ type: "disconnect" });
    await listeners.startup();

    expect(chromeMock.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("sends this browser's install ID with the connection request", async () => {
    await loadWorker();
    await listeners.startup();

    const url = new URL(
      chromeMock.identity.launchWebAuthFlow.mock.calls[0][0].url,
    );
    expect(url.searchParams.get("install_id")).toBe(local.installId);
    expect(local.installId).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("Kazi Timer today's tasks", () => {
  it("lists today's logged tasks when connected", async () => {
    session.kaziAccessToken = "token";
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(200, {
        entries: [
          {
            index: 0,
            task: "Client call",
            client: "Acme",
            category: "Meetings",
            minutes: 35,
          },
        ],
        editable: true,
      }),
    );
    await loadWorker();

    const today = await message({ type: "list-today" });

    expect(today.connected).toBe(true);
    expect(today.entries[0]).toMatchObject({
      task: "Client call",
      minutes: 35,
    });
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(
      /\/api\/extensions\/kazi-timer\/today\?date=\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("reports not connected without a token", async () => {
    await loadWorker();
    expect(await message({ type: "list-today" })).toEqual({
      entries: [],
      editable: false,
      connected: false,
    });
  });

  it("deletes a row by index and task", async () => {
    session.kaziAccessToken = "token";
    globalThis.fetch = vi.fn(async () => jsonResponse(200, { ok: true }));
    await loadWorker();

    const result = await message({
      type: "delete-entry",
      date: "2026-11-02",
      index: 2,
      task: "Remove Job ad",
    });

    expect(result).toEqual({ ok: true });
    const [, init] = globalThis.fetch.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body)).toEqual({
      date: "2026-11-02",
      index: 2,
      task: "Remove Job ad",
    });
  });

  it("shows the server's message when the row changed", async () => {
    session.kaziAccessToken = "token";
    globalThis.fetch = vi.fn(async () =>
      jsonResponse(409, {
        error: "The log changed. Refresh the list and try again.",
      }),
    );
    await loadWorker();

    const result = await message({
      type: "delete-entry",
      date: "2026-11-02",
      index: 0,
      task: "Old",
    });

    expect(result.error).toMatch(/log changed/);
  });
});
