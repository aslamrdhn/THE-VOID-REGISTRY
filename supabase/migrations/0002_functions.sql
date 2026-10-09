-- THE VOID REGISTRY - Migration 0002: Atomic Database Functions
-- Source of truth: PRD §7

-- 1. Publish Post
create or replace function publish_post(
  p_kind post_kind,
  p_body text,
  p_loss bigint,
  p_status post_status,
  p_claim_hash text
) returns setof posts language plpgsql security definer as $$
declare
  v_published_at timestamptz := null;
  v_expires_at timestamptz := null;
begin
  if p_status = 'live' then
    v_published_at := now();
    v_expires_at := now() + interval '24 hours';
  end if;

  return query
  insert into posts (
    kind,
    body,
    financial_loss_idr,
    status,
    published_at,
    expires_at,
    claim_hash
  ) values (
    p_kind,
    p_body,
    p_loss,
    p_status,
    v_published_at,
    v_expires_at,
    p_claim_hash
  )
  returning *;
end;
$$;

-- 2. Approve Post (Admin)
create or replace function approve_post(
  p_post_id uuid,
  p_admin text
) returns setof posts language plpgsql security definer as $$
declare
  v_current_status post_status;
begin
  select status into v_current_status from posts where id = p_post_id;
  if not found then
    raise exception 'post_not_found';
  end if;

  if v_current_status <> 'pending_review' then
    raise exception 'invalid_transition: post is not in pending_review';
  end if;

  -- Insert audit log
  insert into moderation_log (post_id, actor, action, from_status, to_status, reason)
  values (p_post_id, p_admin, 'approve', 'pending_review', 'live', 'Approved by administrator');

  -- Update post (timer starts at approval, NOT submission)
  return query
  update posts
  set status = 'live',
      published_at = now(),
      expires_at = now() + interval '24 hours'
  where id = p_post_id
  returning *;
end;
$$;

-- 3. Cast Respect (1 per voter_hash, atomic)
create or replace function cast_respect(
  p_post_id uuid,
  p_voter_hash text
) returns table(respect_count integer, already boolean) language plpgsql security definer as $$
declare
  v_status post_status;
  v_expires_at timestamptz;
  v_is_immortal boolean;
  v_inserted boolean := false;
  v_current_respect integer;
begin
  -- Validate post existence & eligibility
  select status, expires_at, is_immortal, posts.respect_count
  into v_status, v_expires_at, v_is_immortal, v_current_respect
  from posts
  where id = p_post_id;

  if not found then
    raise exception 'post_not_found';
  end if;

  if v_status <> 'live' or (not v_is_immortal and v_expires_at <= now()) then
    raise exception 'post_not_eligible';
  end if;

  -- Attempt unique insert
  insert into respects (post_id, voter_hash, created_at)
  values (p_post_id, p_voter_hash, now())
  on conflict (post_id, voter_hash) do nothing;

  if found then
    -- Increment only if inserted
    update posts
    set respect_count = posts.respect_count + 1
    where id = p_post_id
    returning posts.respect_count into v_current_respect;

    return query select v_current_respect, false;
  else
    return query select v_current_respect, true;
  end if;
end;
$$;

-- 4. File Report & Auto-Quarantine
create or replace function file_report(
  p_post_id uuid,
  p_reporter_hash text,
  p_reason report_reason,
  p_threshold integer default 3,
  p_severe_threshold integer default 1
) returns table(quarantined boolean, already boolean) language plpgsql security definer as $$
declare
  v_status post_status;
  v_total_reports integer;
  v_severe_reports integer;
  v_should_quarantine boolean := false;
begin
  select status into v_status from posts where id = p_post_id;
  if not found then
    raise exception 'post_not_found';
  end if;

  -- Insert report unique per reporter
  insert into reports (post_id, reporter_hash, reason, created_at)
  values (p_post_id, p_reporter_hash, p_reason, now())
  on conflict (post_id, reporter_hash) do nothing;

  if not found then
    return query select (v_status = 'quarantined'), true;
    return;
  end if;

  -- Increment report_count on posts
  update posts set report_count = report_count + 1 where id = p_post_id;

  -- Check quarantine thresholds only if post is live
  if v_status = 'live' then
    select count(*) into v_total_reports from reports where post_id = p_post_id;
    select count(*) into v_severe_reports from reports
      where post_id = p_post_id and reason in ('personal_data', 'threat_or_selfharm', 'minor');

    if v_severe_reports >= p_severe_threshold or v_total_reports >= p_threshold then
      v_should_quarantine := true;
      update posts set status = 'quarantined' where id = p_post_id;

      insert into moderation_log (post_id, actor, action, from_status, to_status, reason)
      values (p_post_id, 'system', 'auto_quarantine', 'live', 'quarantined', 'Report threshold reached (' || p_reason::text || ')');
    end if;
  end if;

  return query select v_should_quarantine, false;
end;
$$;

-- 5. Apply Paid Order (Idempotent)
create or replace function apply_paid_order(
  p_order_id uuid
) returns table(success boolean, status order_status) language plpgsql security definer as $$
declare
  v_order orders%rowtype;
  v_post posts%rowtype;
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then
    raise exception 'order_not_found';
  end if;

  -- Idempotent check
  if v_order.status = 'paid' then
    return query select true, 'paid'::order_status;
    return;
  end if;

  if v_order.status <> 'pending' then
    return query select false, v_order.status;
    return;
  end if;

  -- Check post
  if v_order.post_id is null then
    update orders set status = 'refund_required' where id = p_order_id;
    return query select true, 'refund_required'::order_status;
    return;
  end if;

  select * into v_post from posts where id = v_order.post_id for update;
  if not found or v_post.status <> 'live' or (not v_post.is_immortal and v_post.expires_at <= now()) then
    -- Post was quarantined, removed, expired, or deleted -> mark refund_required
    update orders set status = 'refund_required' where id = p_order_id;
    return query select true, 'refund_required'::order_status;
    return;
  end if;

  -- Post is live -> immortalize!
  update posts
  set is_immortal = true,
      immortalized_at = coalesce(immortalized_at, now())
  where id = v_order.post_id;

  update orders
  set status = 'paid',
      paid_at = now()
  where id = p_order_id;

  return query select true, 'paid'::order_status;
end;
$$;

-- 6. Expire Posts (Housekeeping cron)
create or replace function expire_posts() returns integer language plpgsql security definer as $$
declare
  v_count integer;
begin
  with updated as (
    update posts
    set status = 'expired'
    where status in ('live', 'quarantined')
      and not is_immortal
      and expires_at <= now()
    returning id
  )
  select count(*) into v_count from updated;
  return v_count;
end;
$$;

-- 7. Purge Posts (Retention physical deletion)
create or replace function purge_posts() returns integer language plpgsql security definer as $$
declare
  v_deleted integer := 0;
  v_sub integer := 0;
begin
  -- 1. Expired posts beyond 7 days
  delete from posts
  where status = 'expired'
    and expires_at < now() - interval '7 days';
  get diagnostics v_sub = row_count;
  v_deleted := v_deleted + v_sub;

  -- 2. Removed posts beyond 30 days
  delete from posts
  where status = 'removed'
    and created_at < now() - interval '30 days';
  get diagnostics v_sub = row_count;
  v_deleted := v_deleted + v_sub;

  -- 3. Moderation logs beyond 12 months
  delete from moderation_log
  where created_at < now() - interval '12 months';

  return v_deleted;
end;
$$;

-- 8. Expire Orders
create or replace function expire_orders() returns integer language plpgsql security definer as $$
declare
  v_count integer;
begin
  with updated as (
    update orders
    set status = 'expired'
    where status = 'pending'
      and expires_at <= now()
    returning id
  )
  select count(*) into v_count from updated;
  return v_count;
end;
$$;
