// THE VOID REGISTRY - Posts API Handler
// Source of truth: PRD §6.1, §6.3, §6.8, §8

import { z } from 'zod';
import { CONFIG } from '../config.ts';
import { filterContent } from '../moderation/filter.ts';
import { generateClaimCode, hashClaimCode, generateAnonId, hashVoter, verifyClaimCode } from '../hash.ts';
import { db } from '../db.ts';
import { checkPostRateLimit, rateLimiter } from '../ratelimit.ts';
import { PublicPost, Post } from '../types.ts';
import { compareHotPosts } from '../hot.ts';

// Validation Schema (PRD §8)
export const CreatePostSchema = z.object({
  kind: z.enum(['failure', 'confession']),
  body: z
    .string()
    .min(CONFIG.BODY_MIN, { message: `Minimal ${CONFIG.BODY_MIN} karakter.` })
    .max(CONFIG.BODY_MAX, { message: `Maksimal ${CONFIG.BODY_MAX} karakter.` }),
  financial_loss_idr: z
    .number()
    .int()
    .min(0, { message: 'Kerugian tidak boleh negatif.' })
    .max(1000000000000, { message: 'Kerugian melebihi batas maksimum 1 Triliun.' })
    .nullable()
    .optional(),
  age_ok: z.literal(true, {
    message: 'Anda harus berusia 18 tahun ke atas dan menyetujui Aturan.',
  }),
  turnstile_token: z.string().optional(),
});

export type CreatePostInput = z.infer<typeof CreatePostSchema>;

export interface CreatePostResult {
  statusCode: number;
  data?: {
    id: string;
    status: 'live' | 'pending_review';
    claim_code: string;
    expires_at: string | null;
    crisis_info?: string;
  };
  error?: string;
  reasons?: string[];
  newAnonId?: string;
}

export function handleCreatePost(
  input: unknown,
  anonId?: string,
  now = new Date()
): CreatePostResult {
  // 1. Zod validation (PRD §8)
  const parseResult = CreatePostSchema.safeParse(input);
  if (!parseResult.success) {
    const issues = parseResult.error.issues || [];
    return {
      statusCode: 400,
      error: 'validation_error',
      reasons: issues.map((e) => e.message),
    };
  }

  const payload = parseResult.data;

  // Enforce DB constraint: financial_loss_idr is null for confession
  const financialLoss = payload.kind === 'failure' ? payload.financial_loss_idr : null;

  // 2. Cookie anon_id assignment
  let activeAnonId = anonId;
  let newAnonId: string | undefined = undefined;
  if (!activeAnonId) {
    activeAnonId = generateAnonId();
    newAnonId = activeAnonId;
  }

  // 3. Rate limiting check (PRD §8)
  const rateLimitCheck = checkPostRateLimit(activeAnonId);
  if (!rateLimitCheck.allowed) {
    return {
      statusCode: 429,
      error: 'rate_limit_exceeded',
      reasons: [rateLimitCheck.reason || 'Terlalu banyak permintaan.'],
      newAnonId,
    };
  }

  // 4. Content filter check (PRD §6.2)
  const filter = filterContent(payload.body);
  if (!filter.passed) {
    return {
      statusCode: 422,
      error: 'content_rejected',
      reasons: filter.hardRejects,
      newAnonId,
    };
  }

  // Quasi-identifier check for doxxing prevention (especially critical for confessions)
  const quasiDoxxingPattern = /\b(?:plat|nopol)\s*[a-z]{1,2}\s*\d{1,4}\s*[a-z]{1,3}\b|\b(?:rek|rekening)\s*(?:bca|mandiri|bni|bri)?\s*\d{8,16}\b/i;
  if (quasiDoxxingPattern.test(payload.body)) {
    return {
      statusCode: 422,
      error: 'content_rejected',
      reasons: ['Terdeteksi nomor plat kendaraan atau detail rekening perbankan.'],
      newAnonId,
    };
  }

  // 5. Claim code generation (PRD §6.5)
  const claimCode = generateClaimCode();
  const claimHash = hashClaimCode(claimCode);

  // 6. Database creation via publishPost (PRD §7)
  const post = db.publishPost({
    kind: payload.kind,
    body: payload.body,
    financial_loss_idr: financialLoss,
    status: filter.status === 'live' ? 'live' : 'pending_review',
    claim_hash: claimHash,
    now,
  });

  const crisisInfo = filter.isCrisis
    ? 'Tulisan Anda sedang ditinjau. Jika Anda sedang mengalami krisis mental atau pikiran menyakiti diri, hubungi layanan dukungan darurat segera (Layanan Kemenkes 119 ekstensi 8).'
    : undefined;

  return {
    statusCode: 201,
    data: {
      id: post.id,
      status: post.status === 'live' ? 'live' : 'pending_review',
      claim_code: claimCode,
      expires_at: post.expires_at,
      crisis_info: crisisInfo,
    },
    newAnonId,
  };
}

/**
 * PRD §4 & §8: GET /api/posts
 * Always filters status = 'live' AND (is_immortal OR expires_at > now)
 */
export function handleGetPosts(
  tab: 'hot' | 'new' | 'hall' = 'hot',
  cursor?: string,
  now = new Date(),
  kindFilter: 'all' | 'failure' | 'confession' = 'all'
): {
  statusCode: number;
  data: {
    items: PublicPost[];
    next_cursor: string | null;
    server_now: string;
  };
} {
  const allPosts = Array.from(db.posts.values());

  // Strict data truth filter: status = 'live' AND (is_immortal OR expires_at > now)
  const livePosts = allPosts.filter((post) => {
    if (post.status !== 'live') return false;
    if (kindFilter !== 'all' && post.kind !== kindFilter) return false;
    if (post.is_immortal) return true;
    if (!post.expires_at) return false;
    return new Date(post.expires_at) > now;
  });

  let filtered: Post[] = [];

  if (tab === 'hall') {
    // Hall of Fame: immortal only, ordered by immortalized_at DESC
    filtered = livePosts
      .filter((p) => p.is_immortal)
      .sort((a, b) => {
        const timeA = a.immortalized_at ? new Date(a.immortalized_at).getTime() : 0;
        const timeB = b.immortalized_at ? new Date(b.immortalized_at).getTime() : 0;
        return timeB - timeA;
      });
  } else if (tab === 'new') {
    // Baru: live, non-immortal, published_at DESC
    filtered = livePosts
      .filter((p) => !p.is_immortal)
      .sort((a, b) => {
        const timeA = a.published_at ? new Date(a.published_at).getTime() : 0;
        const timeB = b.published_at ? new Date(b.published_at).getTime() : 0;
        return timeB - timeA;
      });
  } else {
    // Hot: live, non-immortal, sorted by HOT score DESC
    filtered = livePosts
      .filter((p) => !p.is_immortal)
      .sort((a, b) => compareHotPosts(a, b, now));
  }

  // Cursor-based / slice pagination
  let startIndex = 0;
  if (cursor) {
    const foundIndex = filtered.findIndex((p) => p.id === cursor);
    if (foundIndex >= 0) {
      startIndex = foundIndex + 1;
    }
  }

  const pageSize = CONFIG.FEED_PAGE_SIZE;
  const pageSlice = filtered.slice(startIndex, startIndex + pageSize);
  const nextCursor =
    startIndex + pageSize < filtered.length ? pageSlice[pageSlice.length - 1]?.id ?? null : null;

  return {
    statusCode: 200,
    data: {
      items: pageSlice.map((p) => db.toPublicPost(p)),
      next_cursor: nextCursor,
      server_now: now.toISOString(),
    },
  };
}

/**
 * PRD §8: GET /api/posts/:id
 */
export function handleGetPostById(
  id: string,
  now = new Date()
): {
  statusCode: number;
  data?: PublicPost & { server_now: string };
  error?: string;
} {
  const post = db.posts.get(id);
  if (!post) {
    return { statusCode: 404, error: 'post_not_found' };
  }

  // Check if live and not expired
  const isLive = post.status === 'live';
  const isNotExpired = post.is_immortal || (post.expires_at && new Date(post.expires_at) > now);

  if (!isLive || !isNotExpired) {
    return { statusCode: 404, error: 'post_expired_or_not_live' };
  }

  return {
    statusCode: 200,
    data: {
      ...db.toPublicPost(post),
      server_now: now.toISOString(),
    },
  };
}

/**
 * PRD §6.3 & §8: POST /api/posts/:id/respect
 */
export function handleCastRespect(
  postId: string,
  anonId: string,
  now = new Date()
): {
  statusCode: number;
  data?: { respect_count: number; already: boolean };
  error?: string;
} {
  // Rate limit: 60 / minute per anon
  const resRate = rateLimiter.check(`respect:${anonId}`, 60, 60 * 1000);
  if (!resRate.allowed) {
    return { statusCode: 429, error: 'rate_limit_exceeded' };
  }

  const voterHash = hashVoter(anonId);

  try {
    const result = db.castRespect(postId, voterHash, now);
    return {
      statusCode: 200,
      data: result,
    };
  } catch (err: any) {
    if (err.message === 'post_not_found' || err.message === 'post_not_eligible') {
      return { statusCode: 404, error: err.message };
    }
    return { statusCode: 500, error: 'internal_error' };
  }
}

/**
 * PRD §6.1 & §8: POST /api/posts/:id/delete (Author self-delete)
 */
export function handleDeletePost(
  postId: string,
  claimCode: string,
  now = new Date()
): {
  statusCode: number;
  data?: { ok: boolean };
  error?: string;
} {
  const post = db.posts.get(postId);
  if (!post) {
    return { statusCode: 404, error: 'post_not_found' };
  }

  // Verify claim code
  const isValid = verifyClaimCode(claimCode, post.claim_hash);
  if (!isValid) {
    return { statusCode: 403, error: 'invalid_claim_code' };
  }

  try {
    db.transitionPost(postId, 'removed', 'author', 'Author self-deleted with valid claim code', now);
    return {
      statusCode: 200,
      data: { ok: true },
    };
  } catch (err: any) {
    return { statusCode: 400, error: err.message };
  }
}
