// THE VOID REGISTRY - Database & Model Types
// Source of truth: PRD §7

export type PostKind = 'failure' | 'confession';

export type PostStatus =
  | 'pending_review'
  | 'live'
  | 'quarantined'
  | 'removed'
  | 'expired';

export type ReportReason =
  | 'personal_data'
  | 'defamation'
  | 'threat_or_selfharm'
  | 'minor'
  | 'spam'
  | 'other';

export type OrderProduct = 'immortalize' | 'spotlight';

export type OrderStatus =
  | 'pending'
  | 'paid'
  | 'expired'
  | 'failed'
  | 'refund_required'
  | 'refunded';

export interface Post {
  id: string;
  kind: PostKind;
  body: string;
  financial_loss_idr: number | null;
  status: PostStatus;
  created_at: string;
  published_at: string | null;
  expires_at: string | null;
  is_immortal: boolean;
  immortalized_at: string | null;
  respect_count: number;
  report_count: number;
  claim_hash: string;
}

// Public Post format (PRD §8 - never exposes claim_hash, report_count, or voter data)
export interface PublicPost {
  id: string;
  kind: PostKind;
  body: string;
  financial_loss_idr: number | null;
  published_at: string | null;
  expires_at: string | null;
  is_immortal: boolean;
  respect_count: number;
}

export interface Respect {
  post_id: string;
  voter_hash: string;
  created_at: string;
}

export interface Report {
  id: string;
  post_id: string;
  reporter_hash: string;
  reason: ReportReason;
  created_at: string;
}

export interface ModerationLog {
  id: number;
  post_id: string | null;
  actor: string;
  action: string;
  from_status: PostStatus | null;
  to_status: PostStatus | null;
  reason: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  post_id: string | null;
  product: OrderProduct;
  amount_idr: number;
  status: OrderStatus;
  provider: string;
  provider_ref: string | null;
  qr_string: string | null;
  expires_at: string;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
}

export interface WebhookEvent {
  id: number;
  provider: string;
  event_id: string;
  received_at: string;
  processed_at: string | null;
  outcome: string | null;
}
