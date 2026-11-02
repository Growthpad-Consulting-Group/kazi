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
      periodInMinutes: 1,
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
