import { describe, it, expect } from 'vitest';
import { calculateHotScore, compareHotPosts } from '../lib/hot.ts';
import { CONFIG } from '../lib/config.ts';

describe('M3 - HOT Ranking Score Tests (§6.8)', () => {
  it('calculates expected score at age 0', () => {
    const now = new Date('2026-06-01T12:00:00Z');
    const publishedAt = new Date('2026-06-01T12:00:00Z');

    // age = 0
    // (0 + 1) / (0 + 2)^1.5 = 1 / 2.828427... ≈ 0.35355
    const score0 = calculateHotScore(0, publishedAt, now, CONFIG.HOT_GRAVITY);
    expect(score0).toBeCloseTo(0.35355, 3);

    // respect = 10 -> (10 + 1) / 2.828427 ≈ 3.889
    const score10 = calculateHotScore(10, publishedAt, now, CONFIG.HOT_GRAVITY);
    expect(score10).toBeCloseTo(3.889, 2);
  });

  it('decays score as age increases', () => {
    const pub = new Date('2026-06-01T00:00:00Z');
    const respectCount = 50;

    const hour1 = new Date('2026-06-01T01:00:00Z');
    const hour5 = new Date('2026-06-01T05:00:00Z');
    const hour20 = new Date('2026-06-01T20:00:00Z');

    const score1 = calculateHotScore(respectCount, pub, hour1);
    const score5 = calculateHotScore(respectCount, pub, hour5);
    const score20 = calculateHotScore(respectCount, pub, hour20);

    expect(score1).toBeGreaterThan(score5);
    expect(score5).toBeGreaterThan(score20);
  });

  it('ranks high-respect post above new low-respect post correctly', () => {
    const now = new Date('2026-06-01T12:00:00Z');

    // Post A: 4 hours old with 100 respects
    const postA = {
      respect_count: 100,
      published_at: new Date('2026-06-01T08:00:00Z').toISOString(),
    };

    // Post B: 10 minutes old with 0 respects
    const postB = {
      respect_count: 0,
      published_at: new Date('2026-06-01T11:50:00Z').toISOString(),
    };

    // Post A score: (101) / (4 + 2)^1.5 = 101 / 14.6969 ≈ 6.87
    // Post B score: (1) / (0.166 + 2)^1.5 = 1 / 3.19 ≈ 0.31
    expect(compareHotPosts(postA, postB, now)).toBeLessThan(0); // postA comes first (diff is negative in sort descending)
  });
});
