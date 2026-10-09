// THE VOID REGISTRY - Moderation & Admin API Handler
// Source of truth: PRD §6.1, §6.4, §8, §10

import { z } from 'zod';
import { db } from '../db.ts';
import { hashVoter } from '../hash.ts';
import { rateLimiter } from '../ratelimit.ts';
import { ReportReason, Post, ModerationLog, Order } from '../types.ts';
import { CONFIG } from '../config.ts';

// Allowed Admin Emails allowlist (§10 & §14)
export function getAdminEmails(): string[] {
  const envEmails = typeof process !== 'undefined' && process.env?.ADMIN_EMAILS;
  if (envEmails) {
    return envEmails.split(',').map((e) => e.trim().toLowerCase());
  }
  return ['admin@thevoidregistry.com'];
}

export function isAuthorizedAdmin(email: string): boolean {
  const allowed = getAdminEmails();
  return allowed.includes(email.trim().toLowerCase());
}

export const ReportSchema = z.object({
  reason: z.enum([
    'personal_data',
    'defamation',
    'threat_or_selfharm',
    'minor',
    'spam',
    'other',
  ]),
});

/**
 * PRD §6.4 & §8: POST /api/posts/:id/report
 */
export function handleCreateReport(
  postId: string,
  input: unknown,
  anonId: string,
  now = new Date()
): {
  statusCode: number;
  data?: { ok: boolean; quarantined: boolean; already: boolean };
  error?: string;
} {
  // 1. Zod parse
  const parse = ReportSchema.safeParse(input);
  if (!parse.success) {
    return { statusCode: 400, error: 'invalid_report_reason' };
  }

  // 2. Rate limit: 10 reports / hour per anon (§8)
  const rate = rateLimiter.check(`report:${anonId}`, 10, 3600 * 1000);
  if (!rate.allowed) {
    return { statusCode: 429, error: 'rate_limit_exceeded' };
  }

  // 3. Unique reporter hash
  const reporterHash = hashVoter(anonId);

  try {
    const result = db.fileReport(
      postId,
      reporterHash,
      parse.data.reason as ReportReason,
      CONFIG.REPORT_QUARANTINE_THRESHOLD,
      CONFIG.REPORT_SEVERE_THRESHOLD,
      now
    );

    return {
      statusCode: 200,
      data: {
        ok: true,
        quarantined: result.quarantined,
        already: result.already,
      },
    };
  } catch (err: any) {
    if (err.message === 'post_not_found') {
      return { statusCode: 404, error: 'post_not_found' };
    }
    return { statusCode: 500, error: err.message };
  }
}

/**
 * PRD §4 & §10: Admin Queue & Moderation Log
 */
export function handleGetAdminData(adminEmail: string): {
  statusCode: number;
  data?: {
    pendingQueue: Post[];
    quarantineQueue: Post[];
    refundOrders: Order[];
    moderationLogs: ModerationLog[];
    totalStats: {
      totalPosts: number;
      livePosts: number;
      quarantinedPosts: number;
      removedPosts: number;
      expiredPosts: number;
    };
  };
  error?: string;
} {
  if (!isAuthorizedAdmin(adminEmail)) {
    return { statusCode: 403, error: 'unauthorized_admin' };
  }

  const allPosts = Array.from(db.posts.values());
  const pendingQueue = allPosts.filter((p) => p.status === 'pending_review');
  const quarantineQueue = allPosts.filter((p) => p.status === 'quarantined');
  const refundOrders = Array.from(db.orders.values()).filter(
    (o) => o.status === 'refund_required'
  );

  return {
    statusCode: 200,
    data: {
      pendingQueue,
      quarantineQueue,
      refundOrders,
      moderationLogs: [...db.moderationLogs].reverse(),
      totalStats: {
        totalPosts: allPosts.length,
        livePosts: allPosts.filter((p) => p.status === 'live').length,
        quarantinedPosts: quarantineQueue.length,
        removedPosts: allPosts.filter((p) => p.status === 'removed').length,
        expiredPosts: allPosts.filter((p) => p.status === 'expired').length,
      },
    },
  };
}

/**
 * PRD §6.1: Admin Approve Post (pending_review -> live)
 */
export function handleAdminApprove(
  postId: string,
  adminEmail: string,
  now = new Date()
): { statusCode: number; data?: Post; error?: string } {
  if (!isAuthorizedAdmin(adminEmail)) {
    return { statusCode: 403, error: 'unauthorized_admin' };
  }

  try {
    const post = db.approvePost(postId, adminEmail, now);
    return { statusCode: 200, data: post };
  } catch (err: any) {
    return { statusCode: 400, error: err.message };
  }
}

/**
 * PRD §6.1: Admin Restore Quarantined Post (quarantined -> live)
 */
export function handleAdminRestore(
  postId: string,
  adminEmail: string,
  reason: string,
  now = new Date()
): { statusCode: number; data?: Post; error?: string } {
  if (!isAuthorizedAdmin(adminEmail)) {
    return { statusCode: 403, error: 'unauthorized_admin' };
  }

  if (!reason || reason.trim().length === 0) {
    return { statusCode: 400, error: 'reason_required' };
  }

  try {
    const post = db.transitionPost(postId, 'live', adminEmail, reason, now);
    return { statusCode: 200, data: post };
  } catch (err: any) {
    return { statusCode: 400, error: err.message };
  }
}

/**
 * PRD §6.1: Admin Remove Post (pending_review/live/quarantined -> removed)
 */
export function handleAdminRemove(
  postId: string,
  adminEmail: string,
  reason: string,
  now = new Date()
): { statusCode: number; data?: Post; error?: string } {
  if (!isAuthorizedAdmin(adminEmail)) {
    return { statusCode: 403, error: 'unauthorized_admin' };
  }

  if (!reason || reason.trim().length === 0) {
    return { statusCode: 400, error: 'reason_required' };
  }

  try {
    const post = db.transitionPost(postId, 'removed', adminEmail, reason, now);
    return { statusCode: 200, data: post };
  } catch (err: any) {
    return { statusCode: 400, error: err.message };
  }
}

/**
 * PRD §9: Admin Mark Order as Refunded
 */
export function handleAdminMarkRefunded(
  orderId: string,
  adminEmail: string,
  now = new Date()
): { statusCode: number; data?: Order; error?: string } {
  if (!isAuthorizedAdmin(adminEmail)) {
    return { statusCode: 403, error: 'unauthorized_admin' };
  }

  const order = db.orders.get(orderId);
  if (!order) {
    return { statusCode: 404, error: 'order_not_found' };
  }

  if (order.status !== 'refund_required') {
    return { statusCode: 400, error: 'order_not_in_refund_required_state' };
  }

  order.status = 'refunded';
  order.refunded_at = now.toISOString();

  db.moderationLogs.push({
    id: db.moderationLogs.length + 1,
    post_id: order.post_id,
    actor: adminEmail,
    action: 'mark_refunded',
    from_status: null,
    to_status: null,
    reason: `Manual refund marked by admin for order ${orderId}`,
    created_at: now.toISOString(),
  });

  return { statusCode: 200, data: { ...order } };
}
