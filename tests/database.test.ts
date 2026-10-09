import { describe, it, expect, beforeEach } from 'vitest';
import { VoidDatabase } from '../lib/db.ts';
import { CONFIG } from '../lib/config.ts';

describe('M1 - Database & State Machine Tests', () => {
  let db: VoidDatabase;

  beforeEach(() => {
    db = new VoidDatabase();
  });

  // Requirement 1: Respect ganda tidak menaikkan hitungan
  describe('Requirement 1: Respect Deduplication', () => {
    it('does not increment respect_count on duplicate vote from same voter_hash', () => {
      const post = db.publishPost({
        kind: 'failure',
        body: 'Saya gagal meluncurkan produk tepat waktu karena salah arsitektur.',
        status: 'live',
        claim_hash: 'hash-test-claim-1',
      });

      expect(post.respect_count).toBe(0);

      // First vote from voter A
      const res1 = db.castRespect(post.id, 'voter_hash_A');
      expect(res1.already).toBe(false);
      expect(res1.respect_count).toBe(1);

      // Second vote from voter A (duplicate)
      const res2 = db.castRespect(post.id, 'voter_hash_A');
      expect(res2.already).toBe(true);
      expect(res2.respect_count).toBe(1);

      // Vote from voter B (distinct)
      const res3 = db.castRespect(post.id, 'voter_hash_B');
      expect(res3.already).toBe(false);
      expect(res3.respect_count).toBe(2);

      // Verify stored post
      const stored = db.posts.get(post.id)!;
      expect(stored.respect_count).toBe(2);
    });

    it('rejects respect on non-live or expired post', () => {
      const now = new Date('2026-01-01T12:00:00Z');
      const post = db.publishPost({
        kind: 'failure',
        body: 'Saya gagal meluncurkan produk tepat waktu karena salah arsitektur.',
        status: 'pending_review',
        claim_hash: 'hash-test-claim-2',
        now,
      });

      expect(() => db.castRespect(post.id, 'voter_1', now)).toThrow('post_not_eligible');

      // Now test expired post
      const livePost = db.publishPost({
        kind: 'failure',
        body: 'Saya gagal meluncurkan produk tepat waktu karena salah arsitektur.',
        status: 'live',
        claim_hash: 'hash-test-claim-3',
        now,
      });

      const after25Hours = new Date(now.getTime() + 25 * 3600 * 1000);
      expect(() => db.castRespect(livePost.id, 'voter_1', after25Hours)).toThrow('post_not_eligible');
    });
  });

  // Requirement 2: Transisi tidak valid ditolak
  describe('Requirement 2: State Machine Validation', () => {
    it('accepts valid transitions according to PRD §6.1', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const post = db.publishPost({
        kind: 'failure',
        body: 'Bisnis kopi bangkrut karena sewa terlalu mahal.',
        status: 'pending_review',
        claim_hash: 'hash-claim-trans',
        now,
      });

      // pending_review -> live (approve)
      const approved = db.approvePost(post.id, 'admin@thevoidregistry.com', now);
      expect(approved.status).toBe('live');
      expect(approved.published_at).toBe(now.toISOString());
      expect(approved.expires_at).toBe(new Date(now.getTime() + 24 * 3600 * 1000).toISOString());

      // live -> quarantined
      const quarantined = db.transitionPost(post.id, 'quarantined', 'admin', 'review report', now);
      expect(quarantined.status).toBe('quarantined');

      // quarantined -> live (restored within expiry window)
      const restored = db.transitionPost(post.id, 'live', 'admin', 'false positive', now);
      expect(restored.status).toBe('live');

      // live -> removed
      const removed = db.transitionPost(post.id, 'removed', 'author', 'author delete', now);
      expect(removed.status).toBe('removed');
    });

    it('rejects invalid transitions', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const post = db.publishPost({
        kind: 'failure',
        body: 'Bisnis kopi bangkrut karena sewa terlalu mahal.',
        status: 'live',
        claim_hash: 'hash-claim-invalid',
        now,
      });

      // live -> pending_review is invalid!
      expect(() =>
        db.transitionPost(post.id, 'pending_review', 'admin', 'test', now)
      ).toThrow(/invalid_transition/);

      // removed -> live is invalid!
      const removed = db.transitionPost(post.id, 'removed', 'admin', 'takedown', now);
      expect(() =>
        db.transitionPost(removed.id, 'live', 'admin', 'restore', now)
      ).toThrow(/invalid_transition/);
    });

    it('rejects restoring quarantined post if already expired and not immortal', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const post = db.publishPost({
        kind: 'failure',
        body: 'Bisnis kopi bangkrut karena sewa terlalu mahal.',
        status: 'live',
        claim_hash: 'hash-claim-exp',
        now,
      });

      db.transitionPost(post.id, 'quarantined', 'system', 'quarantined', now);

      // Time advances 26 hours later
      const future = new Date(now.getTime() + 26 * 3600 * 1000);
      expect(() =>
        db.transitionPost(post.id, 'live', 'admin', 'unquarantine after expiry', future)
      ).toThrow(/cannot restore expired quarantined post/);
    });
  });

  // Requirement 3: apply_paid_order idempoten dan menghasilkan refund_required saat tulisan bukan live
  describe('Requirement 3: Immortalize & apply_paid_order Idempotency', () => {
    it('successfully immortalizes a live post and is idempotent', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const post = db.publishPost({
        kind: 'failure',
        body: 'Kisah kegagalan startup fintech yang sangat berharga dan viral.',
        status: 'live',
        claim_hash: 'hash-claim-paid',
        now,
      });

      // Create an order
      const orderId = 'order-uuid-1';
      db.orders.set(orderId, {
        id: orderId,
        post_id: post.id,
        product: 'immortalize',
        amount_idr: CONFIG.IMMORTALIZE_PRICE_IDR,
        status: 'pending',
        provider: 'midtrans',
        provider_ref: 'midtrans-trx-1',
        qr_string: 'qr-sample',
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        paid_at: null,
        refunded_at: null,
        created_at: now.toISOString(),
      });

      // First webhook call
      const res1 = db.applyPaidOrder(orderId, now);
      expect(res1.success).toBe(true);
      expect(res1.status).toBe('paid');

      const updatedPost = db.posts.get(post.id)!;
      expect(updatedPost.is_immortal).toBe(true);
      expect(updatedPost.immortalized_at).not.toBeNull();

      // Second webhook call (idempotent duplicate webhook)
      const res2 = db.applyPaidOrder(orderId, now);
      expect(res2.success).toBe(true);
      expect(res2.status).toBe('paid');
    });

    it('sets order to refund_required if post is not live (e.g. quarantined, removed, or expired)', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const post = db.publishPost({
        kind: 'failure',
        body: 'Kisah kegagalan yang dilaporkan dan dikarantina sebelum pembayaran selesai.',
        status: 'live',
        claim_hash: 'hash-claim-quarantined',
        now,
      });

      const orderId = 'order-uuid-2';
      db.orders.set(orderId, {
        id: orderId,
        post_id: post.id,
        product: 'immortalize',
        amount_idr: CONFIG.IMMORTALIZE_PRICE_IDR,
        status: 'pending',
        provider: 'midtrans',
        provider_ref: 'midtrans-trx-2',
        qr_string: 'qr-sample',
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        paid_at: null,
        refunded_at: null,
        created_at: now.toISOString(),
      });

      // Post gets quarantined before payment confirms
      db.transitionPost(post.id, 'quarantined', 'system', 'severe report', now);

      // Payment arrives
      const res = db.applyPaidOrder(orderId, now);
      expect(res.success).toBe(true);
      expect(res.status).toBe('refund_required');

      const order = db.orders.get(orderId)!;
      expect(order.status).toBe('refund_required');

      // Post remains not immortal
      const currentPost = db.posts.get(post.id)!;
      expect(currentPost.is_immortal).toBe(false);
    });

    it('sets order to refund_required if post has expired before payment arrives', () => {
      const now = new Date('2026-01-01T10:00:00Z');
      const post = db.publishPost({
        kind: 'failure',
        body: 'Kisah kegagalan yang sudah kedaluwarsa sebelum pembayaran dikonfirmasi.',
        status: 'live',
        claim_hash: 'hash-claim-expired',
        now,
      });

      const orderId = 'order-uuid-3';
      db.orders.set(orderId, {
        id: orderId,
        post_id: post.id,
        product: 'immortalize',
        amount_idr: CONFIG.IMMORTALIZE_PRICE_IDR,
        status: 'pending',
        provider: 'midtrans',
        provider_ref: 'midtrans-trx-3',
        qr_string: 'qr-sample',
        expires_at: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
        paid_at: null,
        refunded_at: null,
        created_at: now.toISOString(),
      });

      // 25 hours later
      const future = new Date(now.getTime() + 25 * 3600 * 1000);
      const res = db.applyPaidOrder(orderId, future);
      expect(res.status).toBe('refund_required');
    });
  });

  // Requirement 4: expire_posts hanya menyentuh non-immortal
  describe('Requirement 4: expire_posts strictly touches only non-immortal', () => {
    it('expires overdue non-immortal posts and preserves immortal posts indefinitely', () => {
      const now = new Date('2026-01-01T10:00:00Z');

      // Post 1: Normal post (will expire after 24h)
      const postNormal = db.publishPost({
        kind: 'failure',
        body: 'Kisah biasa yang akan kedaluwarsa setelah batas 24 jam tercapai.',
        status: 'live',
        claim_hash: 'hash-normal',
        now,
      });

      // Post 2: Immortalized post (saved forever)
      const postImmortal = db.publishPost({
        kind: 'failure',
        body: 'Kisah legendaris yang telah diselamatkan menjadi abadi selama-lamanya.',
        status: 'live',
        claim_hash: 'hash-immortal',
        now,
      });
      postImmortal.is_immortal = true;
      postImmortal.immortalized_at = now.toISOString();
      db.posts.set(postImmortal.id, postImmortal);

      // Check right now (0 hours)
      expect(db.expirePosts(now)).toBe(0);

      // 10 hours later
      const after10h = new Date(now.getTime() + 10 * 3600 * 1000);
      expect(db.expirePosts(after10h)).toBe(0);

      // 25 hours later
      const after25h = new Date(now.getTime() + 25 * 3600 * 1000);
      const expiredCount = db.expirePosts(after25h);
      expect(expiredCount).toBe(1);

      // Normal post is now expired
      expect(db.posts.get(postNormal.id)!.status).toBe('expired');

      // Immortal post is STILL live
      expect(db.posts.get(postImmortal.id)!.status).toBe('live');
      expect(db.posts.get(postImmortal.id)!.is_immortal).toBe(true);
    });
  });

  // Reporting and auto-quarantine rules (§6.4)
  describe('Reporting & Auto-quarantine thresholds', () => {
    it('quarantines immediately on 1 severe report (personal_data, threat_or_selfharm, minor)', () => {
      const post = db.publishPost({
        kind: 'failure',
        body: 'Post dengan indikasi data pribadi seseorang yang dilaporkan warga.',
        status: 'live',
        claim_hash: 'hash-severe-rep',
      });

      const res = db.fileReport(post.id, 'reporter_1', 'personal_data');
      expect(res.quarantined).toBe(true);
      expect(db.posts.get(post.id)!.status).toBe('quarantined');
    });

    it('quarantines on 3 general reports (e.g. spam, other)', () => {
      const post = db.publishPost({
        kind: 'failure',
        body: 'Post dengan dugaan spam yang dilaporkan oleh 3 pengunjung unik.',
        status: 'live',
        claim_hash: 'hash-spam-rep',
      });

      // 1st report
      const r1 = db.fileReport(post.id, 'rep_1', 'spam');
      expect(r1.quarantined).toBe(false);

      // duplicate report from rep_1 ignored
      const r1dup = db.fileReport(post.id, 'rep_1', 'spam');
      expect(r1dup.already).toBe(true);

      // 2nd report
      const r2 = db.fileReport(post.id, 'rep_2', 'spam');
      expect(r2.quarantined).toBe(false);

      // 3rd report -> reaches REPORT_QUARANTINE_THRESHOLD = 3
      const r3 = db.fileReport(post.id, 'rep_3', 'spam');
      expect(r3.quarantined).toBe(true);
      expect(db.posts.get(post.id)!.status).toBe('quarantined');
    });
  });
});
