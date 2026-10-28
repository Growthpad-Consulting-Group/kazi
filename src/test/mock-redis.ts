/**
 * In-memory Redis stand-in for tests.
 *
 * Implements only the commands the cache layer uses: get/set/del/sadd/srem/
 * smembers/expire/scan. Values are stored as JSON so the test exercises the
 * same serialisation path as the real Upstash client.
 */

type Entry = { value: string; expiresAt: number | null };

/** Set to true to make every command throw — used to test fail-open behaviour. */
export const redisState = {
  failing: false,
};

// The mock is loaded twice (once via the `vi.mock` factory, once by the test
// file) and each load may get its own module instance. Sharing the state
// through globalThis keeps both views of the same store.
const GLOBAL_KEY = "__kazi_mock_redis__";

interface MockRedisState {
  store: Map<string, Entry>;
  sets: Map<string, Set<string>>;
  ttls: Map<string, number>;
  failing: boolean;
}

const globalRef = globalThis as typeof globalThis & { [GLOBAL_KEY]?: MockRedisState };

const state: MockRedisState = (globalRef[GLOBAL_KEY] ??= {
  store: new Map(),
  sets: new Map(),
  ttls: new Map(),
  failing: false,
});

/** Live view of the failure flag — mutate via `redisState.failing`. */
Object.defineProperty(redisState, "failing", {
  get: () => state.failing,
  set: (value: boolean) => {
    state.failing = value;
  },
  enumerable: true,
  configurable: true,
});

function assertOk() {
  if (state.failing) throw new Error("redis unavailable");
}

function isExpired(entry: Entry | undefined): boolean {
  return !!entry && entry.expiresAt !== null && entry.expiresAt <= Date.now();
}

export const mockRedis = {
  /** Queues commands and runs them in order, like Upstash's pipeline. */
  pipeline() {
    const queued: Array<() => Promise<unknown>> = [];
    const pipe = {
      set: (key: string, value: unknown, opts?: { ex?: number }) => { queued.push(() => mockRedis.set(key, value, opts)); return pipe; },
      sadd: (key: string, ...members: string[]) => { queued.push(() => mockRedis.sadd(key, ...members)); return pipe; },
      expire: (key: string, seconds: number) => { queued.push(() => mockRedis.expire(key, seconds)); return pipe; },
      async exec() {
        const results: unknown[] = [];
        for (const run of queued) results.push(await run());
        return results;
      },
    };
    return pipe;
  },
  /** Live handle on the failure flag, shared across module instances. */
  redisState,

  async get<T>(key: string): Promise<T | null> {
    assertOk();
    const entry = state.store.get(key);
    if (!entry || isExpired(entry)) {
      state.store.delete(key);
      return null;
    }
    return JSON.parse(entry.value) as T;
  },

  async set(key: string, value: unknown, opts?: { ex?: number }): Promise<"OK"> {
    assertOk();
    const ex = opts?.ex;
    state.store.set(key, {
      value: JSON.stringify(value),
      expiresAt: ex ? Date.now() + ex * 1000 : null,
    });
    if (ex) state.ttls.set(key, ex);
    return "OK";
  },

  async incr(key: string): Promise<number> {
    assertOk();
    const entry = state.store.get(key);
    const current = entry && !isExpired(entry) ? Number(JSON.parse(entry.value)) || 0 : 0;
    const next = current + 1;
    state.store.set(key, { value: JSON.stringify(next), expiresAt: entry?.expiresAt ?? null });
    return next;
  },

  async del(...keys: string[]): Promise<number> {
    assertOk();
    let removed = 0;
    for (const key of keys) {
      if (state.store.delete(key)) removed += 1;
      state.ttls.delete(key);
    }
    return removed;
  },

  async sadd(key: string, ...members: string[]): Promise<number> {
    assertOk();
    let set = state.sets.get(key);
    if (!set) {
      set = new Set();
      state.sets.set(key, set);
    }
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added += 1;
      }
    }
    return added;
  },

  async srem(key: string, ...members: string[]): Promise<number> {
    assertOk();
    const set = state.sets.get(key);
    if (!set) return 0;
    let removed = 0;
    for (const m of members) {
      if (set.delete(m)) removed += 1;
    }
    return removed;
  },

  async smembers<T>(key: string): Promise<T[]> {
    assertOk();
    return Array.from(state.sets.get(key) ?? []) as T[];
  },

  async expire(key: string, seconds: number): Promise<number> {
    assertOk();
    const entry = state.store.get(key);
    if (!entry && !state.sets.has(key)) return 0;
    if (entry) entry.expiresAt = Date.now() + seconds * 1000;
    state.ttls.set(key, seconds);
    return 1;
  },

  async scan(
    cursor: string,
    opts?: { match?: string; count?: number }
  ): Promise<[string, string[]]> {
    assertOk();
    const pattern = opts?.match ? new RegExp(`^${opts.match.replace(/\*/g, ".*")}$`) : /.*/;
    const found: string[] = [];
    for (const key of state.store.keys()) {
      if (pattern.test(key)) found.push(key);
    }
    return ["0", found];
  },

  /** Test helpers — not part of the Redis API. */
  __reset() {
    state.store.clear();
    state.sets.clear();
    state.ttls.clear();
    state.failing = false;
  },
  __has(key: string) {
    const entry = state.store.get(key);
    return !!entry && !isExpired(entry);
  },
  __ttl(key: string) {
    return state.ttls.get(key) ?? 0;
  },
  __setIndexSize(group: string) {
    return state.sets.get(`kazi:idx:${group}`)?.size ?? 0;
  },
};

export default mockRedis;
