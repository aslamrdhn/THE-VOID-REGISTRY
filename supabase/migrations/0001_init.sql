-- THE VOID REGISTRY - Migration 0001: Init Schema & RLS
-- Source of truth: PRD §7

create extension if not exists pgcrypto;

-- Enums
create type post_kind     as enum ('failure', 'confession');
create type post_status   as enum ('pending_review', 'live', 'quarantined', 'removed', 'expired');
create type report_reason as enum ('personal_data', 'defamation', 'threat_or_selfharm', 'minor', 'spam', 'other');
create type order_product as enum ('immortalize', 'spotlight');
create type order_status  as enum ('pending', 'paid', 'expired', 'failed', 'refund_required', 'refunded');

-- Posts table
create table posts (
  id                 uuid primary key default gen_random_uuid(),
  kind               post_kind   not null,
  body               text        not null check (char_length(body) between 20 and 1500),
  financial_loss_idr bigint      check (financial_loss_idr is null
                                     or (financial_loss_idr >= 0 and financial_loss_idr <= 1000000000000)),
  status             post_status not null,
  created_at         timestamptz not null default now(),
  published_at       timestamptz,
  expires_at         timestamptz,
  is_immortal        boolean     not null default false,
  immortalized_at    timestamptz,
  respect_count      integer     not null default 0 check (respect_count >= 0),
  report_count       integer     not null default 0 check (report_count >= 0),
  claim_hash         text        not null,
  constraint loss_only_for_failure check (financial_loss_idr is null or kind = 'failure'),
  constraint live_has_times check (status <> 'live'
                                   or (published_at is not null and expires_at is not null))
);

create index posts_live_new_idx on posts (published_at desc) where status = 'live';
create index posts_expiry_idx   on posts (expires_at) where status in ('live', 'quarantined') and not is_immortal;
create index posts_hall_idx     on posts (immortalized_at desc) where status = 'live' and is_immortal;

-- Respects table
create table respects (
  post_id    uuid not null references posts(id) on delete cascade,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_hash)
);

-- Reports table
create table reports (
  id            uuid primary key default gen_random_uuid(),
  post_id       uuid not null references posts(id) on delete cascade,
  reporter_hash text not null,
  reason        report_reason not null,
  created_at    timestamptz not null default now(),
  unique (post_id, reporter_hash)
);

-- Moderation Log (without post content)
create table moderation_log (
  id          bigint generated always as identity primary key,
  post_id     uuid,                    -- intentionally no FK to persist audit
  actor       text not null,           -- 'system' or admin email
  action      text not null,
  from_status post_status,
  to_status   post_status,
  reason      text,
  created_at  timestamptz not null default now()
);

-- Orders table (payment ledger separated from user identity)
create table orders (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid references posts(id) on delete set null,
  product      order_product not null,
  amount_idr   integer not null check (amount_idr > 0),
  status       order_status not null default 'pending',
  provider     text not null,
  provider_ref text unique,
  qr_string    text,
  expires_at   timestamptz not null,
  paid_at      timestamptz,
  refunded_at  timestamptz,
  created_at   timestamptz not null default now()
);

create unique index one_pending_order_per_post
  on orders (post_id, product) where status = 'pending';

-- Webhook events (idempotency, payload is never stored raw)
create table webhook_events (
  id           bigint generated always as identity primary key,
  provider     text not null,
  event_id     text not null,
  received_at  timestamptz not null default now(),
  processed_at timestamptz,
  outcome      text,
  unique (provider, event_id)
);

-- RLS: enabled on all tables, WITHOUT policies (anon key cannot SELECT or INSERT anything)
alter table posts          enable row level security;
alter table respects       enable row level security;
alter table reports        enable row level security;
alter table moderation_log enable row level security;
alter table orders         enable row level security;
alter table webhook_events enable row level security;
