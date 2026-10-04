import "server-only";

/**
 * Minimal key/value abstraction. Upstash Redis is used in production; an
 * in-process store with TTL keeps demo mode (and tests) dependency-free.
 */
export interface KvStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  /** Atomic increment; returns the new value and sets TTL on first write. */
  incr(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<void>;
}

interface MemoryEntry {
  value: string;
  expiresAt: number | null;
}

class MemoryKv implements KvStore {
  private readonly entries = new Map<string, MemoryEntry>();

  private alive(entry: MemoryEntry | undefined): MemoryEntry | null {
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) return null;
    return entry;
  }

  async get(key: string): Promise<string | null> {
    return this.alive(this.entries.get(key))?.value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const current = this.alive(this.entries.get(key));
    const next = (current ? Number(current.value) : 0) + 1;
    this.entries.set(key, {
      value: String(next),
      expiresAt: current?.expiresAt ?? Date.now() + ttlSeconds * 1000,
    });
    return next;
  }

  async del(key: string): Promise<void> {
    this.entries.delete(key);
  }
}

class UpstashKv implements KvStore {
  private client: Promise<import("@upstash/redis").Redis> | null = null;

  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private redis(): Promise<import("@upstash/redis").Redis> {
    if (!this.client) {
      this.client = import("@upstash/redis").then(
        (mod) => new mod.Redis({ url: this.url, token: this.token }),
      );
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    const redis = await this.redis();
    const value = await redis.get<string>(key);
    return value ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const redis = await this.redis();
    if (ttlSeconds) {
      await redis.set(key, value, { ex: ttlSeconds });
    } else {
      await redis.set(key, value);
    }
  }

  async incr(key: string, ttlSeconds: number): Promise<number> {
    const redis = await this.redis();
    const value = await redis.incr(key);
    if (value === 1) {
      await redis.expire(key, ttlSeconds);
    }
    return value;
  }

  async del(key: string): Promise<void> {
    const redis = await this.redis();
    await redis.del(key);
  }
}

let store: KvStore | null = null;

export function getKvStore(): KvStore {
  if (store) return store;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  store = url && token ? new UpstashKv(url, token) : new MemoryKv();
  return store;
}

export function isRedisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}
