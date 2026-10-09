// THE VOID REGISTRY - Rate Limiter
// Source of truth: PRD §8 & §10

interface RateLimitRecord {
  timestamps: number[];
}

export class MemoryRateLimiter {
  private store: Map<string, RateLimitRecord> = new Map();

  check(key: string, limit: number, windowMs: number): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const windowStart = now - windowMs;

    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.store.set(key, record);
    }

    // Filter out timestamps outside the sliding window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);

    if (record.timestamps.length >= limit) {
      return { allowed: false, remaining: 0 };
    }

    record.timestamps.push(now);
    return { allowed: true, remaining: limit - record.timestamps.length };
  }

  reset() {
    this.store.clear();
  }
}

export const rateLimiter = new MemoryRateLimiter();

// Rate limit helper for post creation: 1 per 10 minutes & 5 per 24 hours per anon
export function checkPostRateLimit(identifier: string): { allowed: boolean; reason?: string } {
  // 1 / 10 minutes (600,000 ms)
  const window10m = 10 * 60 * 1000;
  const res10m = rateLimiter.check(`post_10m:${identifier}`, 1, window10m);
  if (!res10m.allowed) {
    return { allowed: false, reason: 'rate_limit_10m: Hanya boleh kirim 1 tulisan per 10 menit.' };
  }

  // 5 / 24 hours (86,400,000 ms)
  const window24h = 24 * 60 * 60 * 1000;
  const res24h = rateLimiter.check(`post_24h:${identifier}`, 5, window24h);
  if (!res24h.allowed) {
    return { allowed: false, reason: 'rate_limit_24h: Batas harian 5 tulisan tercapai.' };
  }

  return { allowed: true };
}
