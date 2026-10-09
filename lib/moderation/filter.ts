// THE VOID REGISTRY - Content Filter & Moderation
// Source of truth: PRD §6.2

import { SENSITIVE_KEYWORDS } from './keywords.ts';

export type HardRejectReason =
  | 'contains_phone'
  | 'contains_email'
  | 'contains_url'
  | 'contains_id_number'
  | 'contains_handle';

export type SensitiveFlag = 'self_harm' | 'threat' | 'minor';

export interface FilterResult {
  passed: boolean;
  hardRejects: HardRejectReason[];
  flaggedCategories: SensitiveFlag[];
  isCrisis: boolean;
  status: 'live' | 'pending_review' | 'rejected';
}

/**
 * Normalizes text per PRD §6.2:
 * 1. Unicode NFKC
 * 2. Lowercase
 * 3. Strip zero-width characters
 */
export function normalizeText(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '');
}

/**
 * Compacts spaces, dots, and hyphens occurring between digits
 * e.g., "0 8 1 2 . 3 4 5 6 - 7 8 9 0" -> "081234567890"
 */
export function compactDigits(text: string): string {
  // Repeatedly remove separators that are flanked by digits
  let result = text;
  let prev = '';
  while (result !== prev) {
    prev = result;
    result = result.replace(/(\d)[\s.\-_]+(\d)/g, '$1$2');
  }
  return result;
}

/**
 * Inspects text for prohibited personal data / contact patterns
 */
export function filterContent(rawText: string): FilterResult {
  const normalized = normalizeText(rawText);
  const digitCompacted = compactDigits(normalized);

  const hardRejects: HardRejectReason[] = [];

  // 1. Phone number (Indonesian formats: +62, 62, 08..., 9-14 digits)
  // Check against digitCompacted
  const phonePattern = /(?:(?:\+?62)|0)8[0-9]{7,12}\b/;
  if (phonePattern.test(digitCompacted)) {
    hardRejects.push('contains_phone');
  }

  // 2. Email pattern
  const emailPattern = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
  if (emailPattern.test(normalized)) {
    hardRejects.push('contains_email');
  }

  // 3. URL pattern (with or without scheme, wa.me, t.me, common tlds)
  const urlPattern =
    /(?:https?:\/\/|ftp:\/\/|wa\.me\/|t\.me\/|bit\.ly\/|[a-z0-9-]+\.(?:com|org|net|id|co\.id|io|xyz|me|app|dev|link|site|info)(?:\/[^\s]*)?)/i;
  if (urlPattern.test(normalized)) {
    hardRejects.push('contains_url');
  }

  // 4. 16-digit ID pattern (NIK / KTP)
  const idNumberPattern = /\b\d{16}\b/;
  if (idNumberPattern.test(digitCompacted)) {
    hardRejects.push('contains_id_number');
  }

  // 5. Social Handle (@name >= 3 chars)
  const handlePattern = /(?:^|\s)@[a-z0-9_.]{3,}/i;
  if (handlePattern.test(normalized)) {
    hardRejects.push('contains_handle');
  }

  // If hard rejects exist, stop here
  if (hardRejects.length > 0) {
    return {
      passed: false,
      hardRejects,
      flaggedCategories: [],
      isCrisis: false,
      status: 'rejected',
    };
  }

  // Check sensitive keyword categories -> pending_review
  const flaggedCategories: SensitiveFlag[] = [];
  let isCrisis = false;

  for (const word of SENSITIVE_KEYWORDS.self_harm) {
    if (normalized.includes(word)) {
      if (!flaggedCategories.includes('self_harm')) flaggedCategories.push('self_harm');
      isCrisis = true;
    }
  }

  for (const word of SENSITIVE_KEYWORDS.threat) {
    if (normalized.includes(word)) {
      if (!flaggedCategories.includes('threat')) flaggedCategories.push('threat');
    }
  }

  for (const word of SENSITIVE_KEYWORDS.minor) {
    if (normalized.includes(word)) {
      if (!flaggedCategories.includes('minor')) flaggedCategories.push('minor');
    }
  }

  if (flaggedCategories.length > 0) {
    return {
      passed: true,
      hardRejects: [],
      flaggedCategories,
      isCrisis,
      status: 'pending_review',
    };
  }

  // Clean post -> live
  return {
    passed: true,
    hardRejects: [],
    flaggedCategories: [],
    isCrisis: false,
    status: 'live',
  };
}
