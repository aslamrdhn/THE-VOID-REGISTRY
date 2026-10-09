// THE VOID REGISTRY - HOT Ranking Algorithm
// Source of truth: PRD §6.8

import { CONFIG } from './config.ts';

/**
 * Calculates HOT ranking score:
 * (respect_count + 1) / power(umur_jam + 2, HOT_GRAVITY)
 *
 * @param respectCount Number of respects given to the post
 * @param publishedAt ISO timestamp when the post went live
 * @param now Current reference time (defaults to Date.now())
 * @param gravity Gravity decay exponent (defaults to CONFIG.HOT_GRAVITY = 1.5)
 */
export function calculateHotScore(
  respectCount: number,
  publishedAt: string | Date,
  now: Date = new Date(),
  gravity: number = CONFIG.HOT_GRAVITY
): number {
  const pubTime = typeof publishedAt === 'string' ? new Date(publishedAt).getTime() : publishedAt.getTime();
  const nowTime = now.getTime();

  // Age in hours, non-negative
  const ageHours = Math.max(0, (nowTime - pubTime) / (3600 * 1000));

  const numerator = respectCount + 1;
  const denominator = Math.pow(ageHours + 2, gravity);

  return numerator / denominator;
}

/**
 * Compares two posts for HOT ranking (descending score)
 */
export function compareHotPosts<
  T extends { respect_count: number; published_at: string | null }
>(a: T, b: T, now = new Date()): number {
  const scoreA = a.published_at ? calculateHotScore(a.respect_count, a.published_at, now) : 0;
  const scoreB = b.published_at ? calculateHotScore(b.respect_count, b.published_at, now) : 0;
  return scoreB - scoreA;
}
