import { describe, it, expect, beforeEach } from 'vitest';
import { handleCreatePost } from '../lib/api/posts.ts';
import { db } from '../lib/db.ts';
import { rateLimiter } from '../lib/ratelimit.ts';
import { hashClaimCode } from '../lib/hash.ts';

describe('M2 - POST /api/posts Handler Tests', () => {
  beforeEach(() => {
    db.clear();
    rateLimiter.reset();
  });

  it('rejects post containing phone number with HTTP 422 and reasons', () => {
    const res = handleCreatePost({
      kind: 'failure',
      body: 'Gagal bisnis karena supplier kabur. Hubungi saya di 081234567890 jika tahu lokasinya.',
      age_ok: true,
    });

    expect(res.statusCode).toBe(422);
    expect(res.error).toBe('content_rejected');
    expect(res.reasons).toContain('contains_phone');
    // Ensure no post was created in the database
    expect(db.posts.size).toBe(0);
  });

  it('generates claim code, stores only hash in DB, and sets expires_at = now + 24h', () => {
    const now = new Date('2026-05-10T14:00:00Z');
    const res = handleCreatePost(
      {
        kind: 'failure',
        body: 'Kami gagal meluncurkan sistem pembayaran karena tidak membaca dokumentasi API mitra.',
        financial_loss_idr: 50000000,
        age_ok: true,
      },
      'anon_user_1',
      now
    );

    expect(res.statusCode).toBe(201);
    expect(res.data).toBeDefined();
    expect(res.data?.status).toBe('live');
    expect(res.data?.claim_code).toMatch(/^VOID-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

    const expectedExpiry = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
    expect(res.data?.expires_at).toBe(expectedExpiry);

    // Verify DB record: DB only holds claim_hash, NOT the plain text claim_code
    const postInDb = db.posts.get(res.data!.id)!;
    expect(postInDb).toBeDefined();
    expect(postInDb.claim_hash).toBe(hashClaimCode(res.data!.claim_code));
    expect((postInDb as any).claim_code).toBeUndefined();
    expect(postInDb.financial_loss_idr).toBe(50000000);
  });

  it('returns 400 when input validation fails (e.g. body too short or age_ok is false)', () => {
    // Body < 20 chars
    const resShort = handleCreatePost({
      kind: 'failure',
      body: 'Terlalu pendek',
      age_ok: true,
    });
    expect(resShort.statusCode).toBe(400);
    expect(resShort.error).toBe('validation_error');

    // age_ok not true
    const resAge = handleCreatePost({
      kind: 'failure',
      body: 'Bisnis startup logistik saya bangkrut karena salah memilih armada pengiriman.',
      age_ok: false,
    });
    expect(resAge.statusCode).toBe(400);
  });

  it('routes sensitive self-harm content to pending_review with crisis support info', () => {
    const res = handleCreatePost({
      kind: 'failure',
      body: 'Setelah kehilangan seluruh tabungan, saya merasa putus asa dan ingin bunuh diri.',
      age_ok: true,
    });

    expect(res.statusCode).toBe(201);
    expect(res.data?.status).toBe('pending_review');
    expect(res.data?.expires_at).toBeNull(); // Timer starts only when approved by admin
    expect(res.data?.crisis_info).toContain('119');

    const postInDb = db.posts.get(res.data!.id)!;
    expect(postInDb.status).toBe('pending_review');
  });

  it('enforces 1 post per 10 minutes rate limit per anon user', () => {
    const anonId = 'anon_fast_poster';
    // 1st post
    const res1 = handleCreatePost(
      {
        kind: 'failure',
        body: 'Post pertama yang menceritakan kegagalan pertama saya di bidang retail.',
        age_ok: true,
      },
      anonId
    );
    expect(res1.statusCode).toBe(201);

    // 2nd post immediately
    const res2 = handleCreatePost(
      {
        kind: 'failure',
        body: 'Post kedua yang dikirim langsung setelah post pertama tanpa jeda waktu.',
        age_ok: true,
      },
      anonId
    );
    expect(res2.statusCode).toBe(429);
    expect(res2.error).toBe('rate_limit_exceeded');
  });
});
