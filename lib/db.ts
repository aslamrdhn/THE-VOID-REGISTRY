// THE VOID REGISTRY - Database & State Machine Layer
// Implements PRD §6.1 & §7 functions atomically

import {
  Post,
  PostKind,
  PostStatus,
  ReportReason,
  Order,
  OrderProduct,
  OrderStatus,
  ModerationLog,
  PublicPost,
} from './types.ts';
import { CONFIG } from './config.ts';

// In-Memory Database Store for testing and offline/local execution
export class VoidDatabase {
  posts: Map<string, Post> = new Map();
  respects: Map<string, Set<string>> = new Map(); // post_id -> Set of voter_hash
  reports: Map<string, Map<string, ReportReason>> = new Map(); // post_id -> Map of reporter_hash: reason
  moderationLogs: ModerationLog[] = [];
  orders: Map<string, Order> = new Map();
  webhookEvents: Map<string, { processed_at: string | null; outcome: string | null }> = new Map();

  private logIdCounter = 1;

  clear() {
    this.posts.clear();
    this.respects.clear();
    this.reports.clear();
    this.moderationLogs = [];
    this.orders.clear();
    this.webhookEvents.clear();
    this.logIdCounter = 1;
  }

  // PRD §7: publish_post
  publishPost(params: {
    id?: string;
    kind: PostKind;
    body: string;
    financial_loss_idr?: number | null;
    status: PostStatus;
    claim_hash: string;
    now?: Date;
  }): Post {
    const now = params.now || new Date();
    const id =
      params.id ||
      (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID
        ? globalThis.crypto.randomUUID()
        : 'uuid-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36));

    if (params.body.length < CONFIG.BODY_MIN || params.body.length > CONFIG.BODY_MAX) {
      throw new Error(`body_length_invalid: must be between ${CONFIG.BODY_MIN} and ${CONFIG.BODY_MAX}`);
    }

    if (params.kind !== 'failure' && params.financial_loss_idr != null) {
      throw new Error('loss_only_for_failure');
    }

    let published_at: string | null = null;
    let expires_at: string | null = null;

    if (params.status === 'live') {
      published_at = now.toISOString();
      const expiry = new Date(now.getTime() + CONFIG.POST_TTL_HOURS * 3600 * 1000);
      expires_at = expiry.toISOString();
    }

    const post: Post = {
      id,
      kind: params.kind,
      body: params.body,
      financial_loss_idr: params.financial_loss_idr ?? null,
      status: params.status,
      created_at: now.toISOString(),
      published_at,
      expires_at,
      is_immortal: false,
      immortalized_at: null,
      respect_count: 0,
      report_count: 0,
      claim_hash: params.claim_hash,
    };

    this.posts.set(id, post);
    return { ...post };
  }

  // PRD §7 & §6.1: approve_post
  approvePost(postId: string, adminEmail: string, now = new Date()): Post {
    const post = this.posts.get(postId);
    if (!post) throw new Error('post_not_found');

    if (post.status !== 'pending_review') {
      throw new Error('invalid_transition: post is not in pending_review');
    }

    // Start timer at approval, NOT submission
    const publishedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + CONFIG.POST_TTL_HOURS * 3600 * 1000).toISOString();

    this.moderationLogs.push({
      id: this.logIdCounter++,
      post_id: postId,
      actor: adminEmail,
      action: 'approve',
      from_status: post.status,
      to_status: 'live',
      reason: 'Approved by admin',
      created_at: now.toISOString(),
    });

    post.status = 'live';
    post.published_at = publishedAt;
    post.expires_at = expiresAt;

    return { ...post };
  }

  // PRD §7 & §6.3: cast_respect (1 per voter_hash, atomic)
  castRespect(postId: string, voterHash: string, now = new Date()): { respect_count: number; already: boolean } {
    const post = this.posts.get(postId);
    if (!post) throw new Error('post_not_found');

    // Only live posts that are not expired
    const isExpired = !post.is_immortal && post.expires_at && new Date(post.expires_at) <= now;
    if (post.status !== 'live' || isExpired) {
      throw new Error('post_not_eligible');
    }

    if (!this.respects.has(postId)) {
      this.respects.set(postId, new Set());
    }

    const voterSet = this.respects.get(postId)!;
    if (voterSet.has(voterHash)) {
      return { respect_count: post.respect_count, already: true };
    }

    voterSet.add(voterHash);
    post.respect_count += 1;

    return { respect_count: post.respect_count, already: false };
  }

  // PRD §7 & §6.4: file_report
  fileReport(
    postId: string,
    reporterHash: string,
    reason: ReportReason,
    threshold = CONFIG.REPORT_QUARANTINE_THRESHOLD,
    severeThreshold = CONFIG.REPORT_SEVERE_THRESHOLD,
    now = new Date()
  ): { quarantined: boolean; already: boolean } {
    const post = this.posts.get(postId);
    if (!post) throw new Error('post_not_found');

    if (!this.reports.has(postId)) {
      this.reports.set(postId, new Map());
    }

    const reportMap = this.reports.get(postId)!;
    if (reportMap.has(reporterHash)) {
      return { quarantined: post.status === 'quarantined', already: true };
    }

    reportMap.set(reporterHash, reason);
    post.report_count += 1;

    let quarantined = false;
    if (post.status === 'live') {
      let severeCount = 0;
      for (const r of reportMap.values()) {
        if (r === 'personal_data' || r === 'threat_or_selfharm' || r === 'minor') {
          severeCount++;
        }
      }

      if (severeCount >= severeThreshold || reportMap.size >= threshold) {
        post.status = 'quarantined';
        quarantined = true;

        this.moderationLogs.push({
          id: this.logIdCounter++,
          post_id: postId,
          actor: 'system',
          action: 'auto_quarantine',
          from_status: 'live',
          to_status: 'quarantined',
          reason: `Report threshold reached (${reason})`,
          created_at: now.toISOString(),
        });
      }
    }

    return { quarantined, already: false };
  }

  // PRD §6.1: Transition Validation
  transitionPost(
    postId: string,
    toStatus: PostStatus,
    actor: string,
    reason: string,
    now = new Date()
  ): Post {
    const post = this.posts.get(postId);
    if (!post) throw new Error('post_not_found');

    const from = post.status;
    const isLiveEligible = post.is_immortal || (post.expires_at && new Date(post.expires_at) > now);

    // Validate state machine according to PRD §6.1:
    let valid = false;

    if (from === 'pending_review' && (toStatus === 'live' || toStatus === 'removed')) {
      valid = true;
    } else if (from === 'live' && (toStatus === 'quarantined' || toStatus === 'removed')) {
      valid = true;
    } else if (from === 'quarantined' && toStatus === 'removed') {
      valid = true;
    } else if (from === 'quarantined' && toStatus === 'live') {
      // Must still be unexpired or immortal
      if (!isLiveEligible) {
        throw new Error('invalid_transition: cannot restore expired quarantined post');
      }
      valid = true;
    } else if ((from === 'live' || from === 'quarantined') && toStatus === 'expired') {
      if (!post.is_immortal && post.expires_at && new Date(post.expires_at) <= now) {
        valid = true;
      } else {
        throw new Error('invalid_transition: post is not expired yet or is immortal');
      }
    }

    if (!valid) {
      throw new Error(`invalid_transition: cannot transition from ${from} to ${toStatus}`);
    }

    this.moderationLogs.push({
      id: this.logIdCounter++,
      post_id: postId,
      actor,
      action: `transition_to_${toStatus}`,
      from_status: from,
      to_status: toStatus,
      reason,
      created_at: now.toISOString(),
    });

    post.status = toStatus;
    return { ...post };
  }

  // PRD §7 & §9: apply_paid_order (Atomic & Idempotent)
  applyPaidOrder(orderId: string, now = new Date()): { success: boolean; status: OrderStatus } {
    const order = this.orders.get(orderId);
    if (!order) throw new Error('order_not_found');

    // Idempotent check: if already paid, return paid no-op
    if (order.status === 'paid') {
      return { success: true, status: 'paid' };
    }

    if (order.status !== 'pending') {
      return { success: false, status: order.status };
    }

    // Check post
    if (!order.post_id) {
      order.status = 'refund_required';
      return { success: true, status: 'refund_required' };
    }

    const post = this.posts.get(order.post_id);
    const isLive = post && post.status === 'live' && (post.is_immortal || (post.expires_at && new Date(post.expires_at) > now));

    if (!post || !isLive) {
      // Post was quarantined, removed, or expired
      order.status = 'refund_required';
      return { success: true, status: 'refund_required' };
    }

    // Post is live -> immortalize!
    post.is_immortal = true;
    post.immortalized_at = post.immortalized_at || now.toISOString();

    order.status = 'paid';
    order.paid_at = now.toISOString();

    return { success: true, status: 'paid' };
  }

  // PRD §7: expire_posts
  expirePosts(now = new Date()): number {
    let count = 0;
    for (const post of this.posts.values()) {
      if ((post.status === 'live' || post.status === 'quarantined') && !post.is_immortal) {
        if (post.expires_at && new Date(post.expires_at) <= now) {
          post.status = 'expired';
          count++;
        }
      }
    }
    return count;
  }

  // PRD §7: expire_orders
  expireOrders(now = new Date()): number {
    let count = 0;
    for (const order of this.orders.values()) {
      if (order.status === 'pending' && new Date(order.expires_at) <= now) {
        order.status = 'expired';
        count++;
      }
    }
    return count;
  }

  // Convert to Public Post (PRD §8)
  toPublicPost(post: Post): PublicPost {
    return {
      id: post.id,
      kind: post.kind,
      body: post.body,
      financial_loss_idr: post.financial_loss_idr,
      published_at: post.published_at,
      expires_at: post.expires_at,
      is_immortal: post.is_immortal,
      respect_count: post.respect_count,
    };
  }
}

// Global default instance
export const db = new VoidDatabase();
