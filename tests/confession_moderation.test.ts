import { describe, it, expect, beforeEach } from 'vitest';
import { handleCreatePost, handleGetPosts } from '../lib/api/posts.ts';
import { evaluateContentWithAI } from '../lib/moderation/aiModerator.ts';
import { db } from '../lib/db.ts';
import { rateLimiter } from '../lib/ratelimit.ts';

describe('Confession Protocol & Enhanced AI Moderation Tests', () => {
  beforeEach(() => {
    db.clear();
    rateLimiter.reset();
  });

  it('allows submission of clean confessions and enforces null financial loss', () => {
    const res = handleCreatePost({
      kind: 'confession',
      body: '[ KARIR & KANTOR ]\nSaya sengaja tidak menghadiri rapat evaluasi tahunan karena tahu seluruh divisi akan di-layoff minggu depannya.',
      financial_loss_idr: 50000000, // Should be sanitized to null for confession
      age_ok: true,
    });

    expect(res.statusCode).toBe(201);
    expect(res.data?.status).toBe('live');
    expect(res.data?.claim_code).toMatch(/^VOID-[0-9A-F]{4}-[0-9A-F]{4}/);

    const postInDb = db.posts.get(res.data!.id)!;
    expect(postInDb.kind).toBe('confession');
    expect(postInDb.financial_loss_idr).toBeNull();
  });

  it('strictly rejects quasi-identifier doxxing (vehicle plate, bank account)', () => {
    // Vehicle plate attempt
    const resPlate = handleCreatePost({
      kind: 'confession',
      body: 'Saya melihat mobil selingkuhan atasan saya dengan plat B 1234 XYZ parkir di depan hotel melati.',
      age_ok: true,
    });
    expect(resPlate.statusCode).toBe(422);
    expect(resPlate.error).toBe('content_rejected');

    // Bank account leak attempt
    const resBank = handleCreatePost({
      kind: 'confession',
      body: 'Uang kantor ditransfer ke rekening BCA 1234567890 oleh bendahara yayasan.',
      age_ok: true,
    });
    expect(resBank.statusCode).toBe(422);
    expect(resBank.error).toBe('content_rejected');
  });

  it('filters feed by kind correctly (all, failure, confession)', () => {
    // Failure post
    db.publishPost({
      kind: 'failure',
      body: 'Gagal membangun bisnis kedai kopi karena salah perhitungan modal.',
      status: 'live',
      claim_hash: 'hash-fail',
    });

    // Confession post
    db.publishPost({
      kind: 'confession',
      body: 'Saya memalsukan sertifikat keahlian saya saat melamar pekerjaan 5 tahun lalu.',
      status: 'live',
      claim_hash: 'hash-conf',
    });

    // All
    const feedAll = handleGetPosts('new', undefined, undefined, 'all');
    expect(feedAll.data.items.length).toBe(2);

    // Failures only
    const feedFail = handleGetPosts('new', undefined, undefined, 'failure');
    expect(feedFail.data.items.length).toBe(1);
    expect(feedFail.data.items[0].kind).toBe('failure');

    // Confessions only
    const feedConf = handleGetPosts('new', undefined, undefined, 'confession');
    expect(feedConf.data.items.length).toBe(1);
    expect(feedConf.data.items[0].kind).toBe('confession');
  });

  it('runs AI moderation engine evaluation correctly', async () => {
    const cleanText =
      'Saya merasa bersalah karena tidak pernah jujur pada orang tua tentang nilai kuliah saya.';
    const res = await evaluateContentWithAI(cleanText, 'confession', { skipNetwork: true });
    expect(res.passed).toBe(true);
    expect(res.safeForLive).toBe(true);
    expect(res.status).toBe('live');
  });
});
