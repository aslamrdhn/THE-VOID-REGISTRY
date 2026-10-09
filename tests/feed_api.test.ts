import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleGetPosts,
  handleGetPostById,
  handleCastRespect,
  handleDeletePost,
} from '../lib/api/posts.ts';
import { db } from '../lib/db.ts';
import { rateLimiter } from '../lib/ratelimit.ts';
import { hashClaimCode } from '../lib/hash.ts';

describe('M3 - Feed API, Expiry Truth & Respect Tests', () => {
  beforeEach(() => {
    db.clear();
    rateLimiter.reset();
  });

  // Acceptance Criterion 1: Tulisan lewat 24 jam hilang dari feed walau cron belum jalan
  it('strictly excludes posts past 24 hours from feed and detail even if cron has not run', () => {
    const startTime = new Date('2026-06-01T10:00:00Z');

    // Publish a live post at startTime
    const post = db.publishPost({
      kind: 'failure',
      body: 'Bisnis katering rugi puluhan juta karena pemadaman listrik massal.',
      status: 'live',
      claim_hash: 'hash-test-1',
      now: startTime,
    });

    // 1 hour later: post is still live and appears in feed
    const time1h = new Date(startTime.getTime() + 1 * 3600 * 1000);
    const feed1h = handleGetPosts('new', undefined, time1h);
    expect(feed1h.data.items.length).toBe(1);
    expect(feed1h.data.items[0].id).toBe(post.id);

    // Detail endpoint returns post
    const detail1h = handleGetPostById(post.id, time1h);
    expect(detail1h.statusCode).toBe(200);

    // 24 hours and 1 minute later: post has expired.
    // Notice: db.expirePosts() has NOT been called!
    const time24h1m = new Date(startTime.getTime() + (24 * 3600 + 60) * 1000);

    // Feed MUST NOT return the post (Data truth principle)
    const feed24h = handleGetPosts('new', undefined, time24h1m);
    expect(feed24h.data.items.length).toBe(0);

    // Detail endpoint MUST return 404
    const detail24h = handleGetPostById(post.id, time24h1m);
    expect(detail24h.statusCode).toBe(404);
  });

  // Acceptance Criterion 2: Respect kedua dari perangkat sama tidak menambah
  it('deduplicates respects per anon voter without incrementing count', () => {
    const now = new Date('2026-06-01T10:00:00Z');
    const post = db.publishPost({
      kind: 'failure',
      body: 'Proyek website e-commerce gagal bayar karena tidak ada SPK tertulis.',
      status: 'live',
      claim_hash: 'hash-test-2',
      now,
    });

    const anonUser = 'anon_device_xyz';

    // 1st respect
    const res1 = handleCastRespect(post.id, anonUser, now);
    expect(res1.statusCode).toBe(200);
    expect(res1.data?.respect_count).toBe(1);
    expect(res1.data?.already).toBe(false);

    // 2nd respect from same anonUser
    const res2 = handleCastRespect(post.id, anonUser, now);
    expect(res2.statusCode).toBe(200);
    expect(res2.data?.respect_count).toBe(1);
    expect(res2.data?.already).toBe(true);

    // Respect from different anon voter
    const res3 = handleCastRespect(post.id, 'anon_device_abc', now);
    expect(res3.statusCode).toBe(200);
    expect(res3.data?.respect_count).toBe(2);
    expect(res3.data?.already).toBe(false);
  });

  it('separates feeds by tabs (new, hot, hall) correctly', () => {
    const now = new Date('2026-06-01T12:00:00Z');

    // Post 1: Normal live post with 5 respects
    const p1 = db.publishPost({
      kind: 'failure',
      body: 'Post pertama yang cukup populer di kalangan pembaca komunitas.',
      status: 'live',
      claim_hash: 'hash-1',
      now: new Date('2026-06-01T10:00:00Z'),
    });
    p1.respect_count = 5;
    db.posts.set(p1.id, p1);

    // Post 2: Newer live post with 0 respects
    const p2 = db.publishPost({
      kind: 'failure',
      body: 'Post kedua yang baru saja diterbitkan beberapa menit yang lalu.',
      status: 'live',
      claim_hash: 'hash-2',
      now: new Date('2026-06-01T11:55:00Z'),
    });

    // Post 3: Immortal post
    const p3 = db.publishPost({
      kind: 'failure',
      body: 'Post ketiga yang telah diselamatkan menjadi abadi selamanya.',
      status: 'live',
      claim_hash: 'hash-3',
      now: new Date('2026-06-01T08:00:00Z'),
    });
    p3.is_immortal = true;
    p3.immortalized_at = new Date('2026-06-01T09:00:00Z').toISOString();
    db.posts.set(p3.id, p3);

    // TAB 'new': Should only contain non-immortal p1 and p2, with p2 first
    const feedNew = handleGetPosts('new', undefined, now);
    expect(feedNew.data.items.length).toBe(2);
    expect(feedNew.data.items[0].id).toBe(p2.id);
    expect(feedNew.data.items[1].id).toBe(p1.id);

    // TAB 'hot': Should contain p1 first because of 5 respects
    const feedHot = handleGetPosts('hot', undefined, now);
    expect(feedHot.data.items.length).toBe(2);
    expect(feedHot.data.items[0].id).toBe(p1.id);

    // TAB 'hall': Should ONLY contain immortal p3
    const feedHall = handleGetPosts('hall', undefined, now);
    expect(feedHall.data.items.length).toBe(1);
    expect(feedHall.data.items[0].id).toBe(p3.id);
    expect(feedHall.data.items[0].is_immortal).toBe(true);
  });

  it('allows author self-deletion with valid claim code', () => {
    const claimCode = 'VOID-A1B2-C3D4-E5F6';
    const claimHash = hashClaimCode(claimCode);

    const post = db.publishPost({
      kind: 'failure',
      body: 'Saya ingin menghapus tulisan ini karena alasan privasi pribadi.',
      status: 'live',
      claim_hash: claimHash,
    });

    // Wrong code -> 403
    const resFail = handleDeletePost(post.id, 'VOID-WRONG-0000-0000');
    expect(resFail.statusCode).toBe(403);

    // Valid code -> 200
    const resSuccess = handleDeletePost(post.id, claimCode);
    expect(resSuccess.statusCode).toBe(200);

    // Post status is now removed and no longer in feed
    expect(db.posts.get(post.id)!.status).toBe('removed');
    const feed = handleGetPosts('new');
    expect(feed.data.items.length).toBe(0);
  });
});
