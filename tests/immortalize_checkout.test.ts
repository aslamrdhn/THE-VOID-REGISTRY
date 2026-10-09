import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleCreateCheckout,
  handleProcessWebhook,
  handleGetOrderStatus,
} from '../lib/api/checkout.ts';
import { db } from '../lib/db.ts';
import { SandboxQrisProvider } from '../lib/payments/provider.ts';
import { hashClaimCode } from '../lib/hash.ts';
import { CONFIG } from '../lib/config.ts';

describe('M6 - Immortalize Checkout, Webhook & Payment Provider Tests', () => {
  let provider: SandboxQrisProvider;

  beforeEach(() => {
    db.clear();
    provider = new SandboxQrisProvider();
  });

  it('strictly validates Immortalize eligibility conditions (§9)', async () => {
    const claimCode = 'VOID-A1B2-C3D4-E5F6';
    const claimHash = hashClaimCode(claimCode);
    const now = new Date('2026-08-01T12:00:00Z');

    // Case A: Post with < 10 respects
    const postFewRespects = db.publishPost({
      kind: 'failure',
      body: 'Kisah kegagalan yang belum mencapai batas minimal apresiasi respect komunitas.',
      status: 'live',
      claim_hash: claimHash,
      now,
    });
    postFewRespects.respect_count = 5;
    db.posts.set(postFewRespects.id, postFewRespects);

    const resFew = await handleCreateCheckout(postFewRespects.id, claimCode, provider, now);
    expect(resFew.statusCode).toBe(409);
    expect(resFew.error).toContain('not_eligible_respects');

    // Case B: Post with > 6 hours remaining (window not reached yet)
    postFewRespects.respect_count = 15;
    // expires in 12 hours
    postFewRespects.expires_at = new Date(now.getTime() + 12 * 3600 * 1000).toISOString();
    db.posts.set(postFewRespects.id, postFewRespects);

    const resWindow = await handleCreateCheckout(postFewRespects.id, claimCode, provider, now);
    expect(resWindow.statusCode).toBe(409);
    expect(resWindow.error).toContain('not_eligible_window');

    // Case C: Wrong claim code
    // set expires in 4 hours (within window)
    postFewRespects.expires_at = new Date(now.getTime() + 4 * 3600 * 1000).toISOString();
    db.posts.set(postFewRespects.id, postFewRespects);

    const resWrongCode = await handleCreateCheckout(
      postFewRespects.id,
      'VOID-WRONG-0000-0000',
      provider,
      now
    );
    expect(resWrongCode.statusCode).toBe(403);

    // Case D: All conditions met -> 201 Created
    const resSuccess = await handleCreateCheckout(postFewRespects.id, claimCode, provider, now);
    expect(resSuccess.statusCode).toBe(201);
    expect(resSuccess.data?.amount_idr).toBe(CONFIG.IMMORTALIZE_PRICE_IDR);
    expect(resSuccess.data?.qr_string).toBeDefined();
  });

  it('processes payment webhook idempotently (duplicate webhook = single effect)', async () => {
    const claimCode = 'VOID-IDEM-0000-0001';
    const now = new Date('2026-08-01T12:00:00Z');

    const post = db.publishPost({
      kind: 'failure',
      body: 'Kisah viral yang memenuhi syarat untuk diselamatkan abadi ke Hall of Fame.',
      status: 'live',
      claim_hash: hashClaimCode(claimCode),
      now,
    });
    post.respect_count = 25;
    post.expires_at = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();
    db.posts.set(post.id, post);

    const checkout = await handleCreateCheckout(post.id, claimCode, provider, now);
    expect(checkout.statusCode).toBe(201);

    const providerRef = checkout.data!.provider_ref;
    // Simulate payment in provider sandbox
    provider.simulatePayment(providerRef);

    const webhookPayload = JSON.stringify({
      event_id: 'evt_123456789',
      provider_ref: providerRef,
    });

    // 1st Webhook delivery
    const res1 = await handleProcessWebhook(webhookPayload, {}, provider, now);
    expect(res1.statusCode).toBe(200);

    const updatedPost = db.posts.get(post.id)!;
    expect(updatedPost.is_immortal).toBe(true);
    expect(updatedPost.immortalized_at).not.toBeNull();

    const orderStatus1 = handleGetOrderStatus(checkout.data!.order_id);
    expect(orderStatus1.data?.status).toBe('paid');

    // 2nd Webhook delivery (duplicate)
    const res2 = await handleProcessWebhook(webhookPayload, {}, provider, now);
    expect(res2.statusCode).toBe(200);

    // Post remains immortal, no error
    expect(db.posts.get(post.id)!.is_immortal).toBe(true);
  });

  it('rejects invalid signature with 401', async () => {
    const res = await handleProcessWebhook('invalid json or missing event', {}, provider);
    expect(res.statusCode).toBe(401);
    expect(res.error).toBe('invalid_signature');
  });

  it('marks order as refund_required if post was removed before webhook arrives', async () => {
    const claimCode = 'VOID-REFU-0000-0001';
    const now = new Date('2026-08-01T12:00:00Z');

    const post = db.publishPost({
      kind: 'failure',
      body: 'Kisah yang dikarantina atau dihapus saat pembayaran sedang berlangsung.',
      status: 'live',
      claim_hash: hashClaimCode(claimCode),
      now,
    });
    post.respect_count = 20;
    post.expires_at = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();
    db.posts.set(post.id, post);

    const checkout = await handleCreateCheckout(post.id, claimCode, provider, now);
    const providerRef = checkout.data!.provider_ref;

    // Post gets removed/quarantined before payment confirms
    db.transitionPost(post.id, 'quarantined', 'system', 'severe doxxing report', now);

    // Payment arrives at provider
    provider.simulatePayment(providerRef);
    const webhookPayload = JSON.stringify({
      event_id: 'evt_refund_test_999',
      provider_ref: providerRef,
    });

    const res = await handleProcessWebhook(webhookPayload, {}, provider, now);
    expect(res.statusCode).toBe(200);

    const orderStatus = handleGetOrderStatus(checkout.data!.order_id);
    expect(orderStatus.data?.status).toBe('refund_required');
  });
});
