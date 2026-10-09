// Client API Layer for THE VOID REGISTRY
// Handles API calls, local storage of claim codes, respects, and anon_id persistence

import {
  handleCreatePost,
  handleGetPosts,
  handleGetPostById,
  handleCastRespect,
  handleDeletePost,
  CreatePostInput,
  CreatePostResult,
} from '@/lib/api/posts.ts';
import { PublicPost } from '@/lib/types.ts';
import { generateAnonId } from '@/lib/hash.ts';

const ANON_ID_KEY = 'void_anon_id';
const SAVED_TOKENS_KEY = 'void_claim_tokens';
const RESPECTED_POSTS_KEY = 'void_respected_posts';
const AGE_GATE_KEY = 'void_age_ok';

export function getOrCreateClientAnonId(): string {
  let anonId = localStorage.getItem(ANON_ID_KEY);
  if (!anonId) {
    anonId = generateAnonId();
    localStorage.setItem(ANON_ID_KEY, anonId);
  }
  return anonId;
}

export interface SavedClaimToken {
  postId: string;
  claimCode: string;
  savedAt: string;
}

export function saveClaimTokenToStorage(postId: string, claimCode: string) {
  try {
    const existing: SavedClaimToken[] = JSON.parse(
      localStorage.getItem(SAVED_TOKENS_KEY) || '[]'
    );
    // Avoid duplicate storage for same postId
    const filtered = existing.filter((item) => item.postId !== postId);
    filtered.unshift({
      postId,
      claimCode,
      savedAt: new Date().toISOString(),
    });
    localStorage.setItem(SAVED_TOKENS_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.error('Failed to save claim token:', err);
  }
}

export function getSavedClaimTokens(): SavedClaimToken[] {
  try {
    return JSON.parse(localStorage.getItem(SAVED_TOKENS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function getClaimTokenForPost(postId: string): string | null {
  const tokens = getSavedClaimTokens();
  const match = tokens.find((t) => t.postId === postId);
  return match ? match.claimCode : null;
}

export function isPostRespectedLocally(postId: string): boolean {
  try {
    const respected: string[] = JSON.parse(localStorage.getItem(RESPECTED_POSTS_KEY) || '[]');
    return respected.includes(postId);
  } catch {
    return false;
  }
}

export function markPostRespectedLocally(postId: string) {
  try {
    const respected: string[] = JSON.parse(localStorage.getItem(RESPECTED_POSTS_KEY) || '[]');
    if (!respected.includes(postId)) {
      respected.push(postId);
      localStorage.setItem(RESPECTED_POSTS_KEY, JSON.stringify(respected));
    }
  } catch (err) {
    console.error('Failed to mark respected:', err);
  }
}

export function hasAcceptedAgeGate(): boolean {
  return localStorage.getItem(AGE_GATE_KEY) === 'true';
}

export function acceptAgeGate() {
  localStorage.setItem(AGE_GATE_KEY, 'true');
}

/**
 * Submits a failure post
 */
export async function submitFailurePost(
  input: Omit<CreatePostInput, 'kind'>
): Promise<CreatePostResult> {
  const anonId = getOrCreateClientAnonId();
  const result = handleCreatePost(
    {
      ...input,
      kind: 'failure',
    },
    anonId
  );
  return result;
}

/**
 * Submits a confession post
 */
export async function submitConfessionPost(
  body: string
): Promise<CreatePostResult> {
  const anonId = getOrCreateClientAnonId();
  const result = handleCreatePost(
    {
      body,
      kind: 'confession',
      age_ok: true,
      financial_loss_idr: null,
    },
    anonId
  );
  return result;
}

/**
 * Fetches feed posts
 */
export async function fetchPosts(
  tab: 'hot' | 'new' | 'hall',
  cursor?: string,
  kindFilter: 'all' | 'failure' | 'confession' = 'all'
): Promise<{ items: PublicPost[]; next_cursor: string | null; server_now: string }> {
  const result = handleGetPosts(tab, cursor, undefined, kindFilter);
  return result.data;
}

/**
 * Fetches a single post by ID
 */
export async function fetchPostById(
  id: string
): Promise<(PublicPost & { server_now: string }) | null> {
  const result = handleGetPostById(id);
  if (result.statusCode === 200 && result.data) {
    return result.data;
  }
  return null;
}

/**
 * Casts respect to a post
 */
export async function castRespectToPost(
  postId: string
): Promise<{ respect_count: number; already: boolean } | null> {
  const anonId = getOrCreateClientAnonId();
  const res = handleCastRespect(postId, anonId);
  if (res.statusCode === 200 && res.data) {
    markPostRespectedLocally(postId);
    return res.data;
  }
  return null;
}

/**
 * Deletes a post with claim code
 */
export async function deletePostWithClaimCode(
  postId: string,
  claimCode: string
): Promise<boolean> {
  const res = handleDeletePost(postId, claimCode);
  return res.statusCode === 200;
}
