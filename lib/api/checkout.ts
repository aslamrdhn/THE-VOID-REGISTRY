// THE VOID REGISTRY - Immortalize Checkout & Webhook API
// Source of truth: PRD §7, §8, §9

import { db } from '../db.ts';
import { CONFIG } from '../config.ts';
import { verifyClaimCode } from '../hash.ts';
import { PaymentProvider, defaultPaymentProvider } from '../payments/provider.ts';
import { Order } from '../types.ts';

export interface CheckoutResult {
  statusCode: number;
  data?: {
    order_id: string;
    amount_idr: number;
    qr_string: string;
    expires_at: string;
    provider_ref: string;
  };
  error?: string;
}

/**
 * PRD §9: POST /api/posts/:id/immortalize/checkout
 */
export async function handleCreateCheckout(
  postId: string,
  claimCode: string,
  provider: PaymentProvider = defaultPaymentProvider,
  now = new Date()
): Promise<CheckoutResult> {
  const post = db.posts.get(postId);
  if (!post) {
    return { statusCode: 404, error: 'post_not_found' };
  }

  // Check 1: Post live & not immortal
  if (post.status !== 'live' || post.is_immortal) {
    return { statusCode: 409, error: 'not_eligible_status' };
  }

  // Check 2: Respect count threshold
  if (post.respect_count < CONFIG.IMMORTALIZE_MIN_RESPECT) {
    return {
      statusCode: 409,
      error: `not_eligible_respects: Minimal ${CONFIG.IMMORTALIZE_MIN_RESPECT} respect dibutuhkan.`,
    };
  }

  // Check 3: Expiry window (<= IMMORTALIZE_WINDOW_HOURS)
  if (!post.expires_at) {
    return { statusCode: 409, error: 'not_eligible_no_expiry' };
  }
  const expiryTime = new Date(post.expires_at).getTime();
  const diffHours = (expiryTime - now.getTime()) / (3600 * 1000);

  if (diffHours <= 0) {
    return { statusCode: 409, error: 'post_already_expired' };
  }
  if (diffHours > CONFIG.IMMORTALIZE_WINDOW_HOURS) {
    return {
      statusCode: 409,
      error: `not_eligible_window: Tombol hanya aktif saat sisa waktu <= ${CONFIG.IMMORTALIZE_WINDOW_HOURS} jam.`,
    };
  }

  // Check 4: Valid claim code
  if (!verifyClaimCode(claimCode, post.claim_hash)) {
    return { statusCode: 403, error: 'invalid_claim_code' };
  }

  // Check 5: Check existing pending order
  for (const ord of db.orders.values()) {
    if (
      ord.post_id === postId &&
      ord.status === 'pending' &&
      new Date(ord.expires_at) > now &&
      ord.qr_string
    ) {
      return {
        statusCode: 200,
        data: {
          order_id: ord.id,
          amount_idr: ord.amount_idr,
          qr_string: ord.qr_string,
          expires_at: ord.expires_at,
          provider_ref: ord.provider_ref || '',
        },
      };
    }
  }

  const orderId =
    typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID
      ? globalThis.crypto.randomUUID()
      : 'ord-' + Math.random().toString(36).slice(2) + '-' + Date.now();

  const amountIdr = CONFIG.IMMORTALIZE_PRICE_IDR;
  const expiresAt = new Date(now.getTime() + CONFIG.ORDER_TTL_MINUTES * 60 * 1000);

  const qrisRes = await provider.createQris({
    orderId,
    amountIdr,
    expiresAt,
  });

  const order: Order = {
    id: orderId,
    post_id: postId,
    product: 'immortalize',
    amount_idr: amountIdr,
    status: 'pending',
    provider: 'midtrans',
    provider_ref: qrisRes.providerRef,
    qr_string: qrisRes.qrString,
    expires_at: expiresAt.toISOString(),
    paid_at: null,
    refunded_at: null,
    created_at: now.toISOString(),
  };

  db.orders.set(orderId, order);

  return {
    statusCode: 201,
    data: {
      order_id: orderId,
      amount_idr: amountIdr,
      qr_string: qrisRes.qrString,
      expires_at: expiresAt.toISOString(),
      provider_ref: qrisRes.providerRef,
    },
  };
}

/**
 * PRD §8: GET /api/orders/:id
 */
export function handleGetOrderStatus(orderId: string): {
  statusCode: number;
  data?: { status: string };
  error?: string;
} {
  const order = db.orders.get(orderId);
  if (!order) {
    return { statusCode: 404, error: 'order_not_found' };
  }
  return {
    statusCode: 200,
    data: { status: order.status },
  };
}

/**
 * PRD §9: POST /api/webhooks/payment
 */
export async function handleProcessWebhook(
  rawBody: string,
  headers: Record<string, string | string[] | undefined>,
  provider: PaymentProvider = defaultPaymentProvider,
  now = new Date()
): Promise<{ statusCode: number; error?: string }> {
  // 1. Verify webhook signature
  const verified = await provider.verifyWebhook({ rawBody, headers });
  if (!verified) {
    return { statusCode: 401, error: 'invalid_signature' };
  }

  // 2. Idempotency check via webhook_events
  const eventKey = `midtrans:${verified.eventId}`;
  const existingEvent = db.webhookEvents.get(eventKey);
  if (existingEvent && existingEvent.processed_at) {
    // Already processed -> return 200 fast
    return { statusCode: 200 };
  }

  db.webhookEvents.set(eventKey, {
    processed_at: null,
    outcome: null,
  });

  // 3. Find matching order
  let targetOrder: Order | undefined;
  for (const ord of db.orders.values()) {
    if (ord.provider_ref === verified.providerRef) {
      targetOrder = ord;
      break;
    }
  }

  if (!targetOrder) {
    return { statusCode: 404, error: 'order_not_found' };
  }

  // 4. Fetch status directly from provider API
  const providerStatus = await provider.fetchStatus(verified.providerRef);

  // 5. Amount mismatch validation
  if (providerStatus.amountIdr !== targetOrder.amount_idr) {
    targetOrder.status = 'failed';
    db.webhookEvents.set(eventKey, {
      processed_at: now.toISOString(),
      outcome: 'amount_mismatch_failed',
    });
    return { statusCode: 200 };
  }

  // 6. Apply payment if provider says paid
  if (providerStatus.status === 'paid') {
    db.applyPaidOrder(targetOrder.id, now);
  }

  // 7. Mark event processed
  db.webhookEvents.set(eventKey, {
    processed_at: now.toISOString(),
    outcome: `success_${targetOrder.status}`,
  });

  return { statusCode: 200 };
}
