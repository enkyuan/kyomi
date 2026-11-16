import type Redis from "ioredis";

export type HostRateLimitStore = {
  acquire(key: string, token: string, ttlMs: number): Promise<boolean>;
  release(key: string, token: string): Promise<void>;
};

export type HostRateLimiter = {
  run<T>(url: string, task: () => Promise<T>): Promise<T>;
};

export type HostRateLimiterOptions = {
  store: HostRateLimitStore;
  leaseMs?: number;
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createMemoryHostRateLimitStore(now = () => Date.now()): HostRateLimitStore {
  const locks = new Map<string, { token: string; expiresAt: number }>();

  return {
    async acquire(key, token, ttlMs) {
      const existing = locks.get(key);
      if (existing && existing.expiresAt > now()) {
        return false;
      }

      locks.set(key, { token, expiresAt: now() + ttlMs });
      return true;
    },
    async release(key, token) {
      if (locks.get(key)?.token === token) {
        locks.delete(key);
      }
    },
  };
}

export function createRedisHostRateLimitStore(redis: Redis): HostRateLimitStore {
  return {
    async acquire(key, token, ttlMs) {
      const result = await redis.set(key, token, "PX", ttlMs, "NX");
      return result === "OK";
    },
    async release(key, token) {
      await redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        key,
        token,
      );
    },
  };
}

export function createHostRateLimiter(options: HostRateLimiterOptions): HostRateLimiter {
  const leaseMs = Math.min(Math.max(options.leaseMs ?? 5_000, 1_000), 60_000);
  const retryDelayMs = Math.min(Math.max(options.retryDelayMs ?? 250, 10), 5_000);
  const sleep = options.sleep ?? defaultSleep;

  return {
    async run<T>(url: string, task: () => Promise<T>): Promise<T> {
      const key = `feed-fetch-host:${new URL(url).host}`;
      const token = crypto.randomUUID();

      while (!(await options.store.acquire(key, token, leaseMs))) {
        await sleep(retryDelayMs);
      }

      try {
        return await task();
      } finally {
        await options.store.release(key, token);
      }
    },
  };
}
