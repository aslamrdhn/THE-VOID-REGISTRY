import { describe, it, expect, beforeEach } from 'vitest';
import {
  handleCreateReport,
  handleGetAdminData,
  handleAdminApprove,
  handleAdminRestore,
  handleAdminRemove,
} from '../lib/api/admin.ts';
import { db } from '../lib/db.ts';
import { rateLimiter } from '../lib/ratelimit.ts';

describe('M4 - Moderation Reports & Admin Panel Tests', () => {
  beforeEach(() => {
    db.clear();
    rateLimiter.reset();
  });

  // Acceptance Criterion 1: 3 laporan unik -> karantina otomatis
  it('automatically quarantines post on 3 unique reports', () => {
    const post = db.publishPost({
      kind: 'failure',
      body: 'Post kegagalan yang dilaporkan oleh beberapa warga karena dugaan spam.',
      status: 'live',
      claim_hash: 'hash-quar-1',
    });

    expect(post.status).toBe('live');

    // Reporter 1
    const r1 = handleCreateReport(post.id, { reason: 'spam' }, 'anon_rep_1');
    expect(r1.statusCode).toBe(200);
    expect(r1.data?.quarantined).toBe(false);

    // Duplicate report from reporter 1 is ignored
    const r1dup = handleCreateReport(post.id, { reason: 'spam' }, 'anon_rep_1');
    expect(r1dup.data?.already).toBe(true);

    // Reporter 2
    const r2 = handleCreateReport(post.id, { reason: 'defamation' }, 'anon_rep_2');
    expect(r2.data?.quarantined).toBe(false);

    // Reporter 3 -> Quarantined!
    const r3 = handleCreateReport(post.id, { reason: 'other' }, 'anon_rep_3');
    expect(r3.data?.quarantined).toBe(true);

    // Post is quarantined in DB
    const updated = db.posts.get(post.id)!;
    expect(updated.status).toBe('quarantined');

    // Moderation log was recorded
    const log = db.moderationLogs.find((l) => l.post_id === post.id);
    expect(log).toBeDefined();
    expect(log?.actor).toBe('system');
    expect(log?.action).toBe('auto_quarantine');
  });

  // Acceptance Criterion 2: 1 laporan personal_data -> karantina
  it('immediately quarantines on 1 severe report (personal_data, threat_or_selfharm, minor)', () => {
    const post = db.publishPost({
      kind: 'failure',
      body: 'Post kegagalan yang memuat identitas nomor KTP orang lain tanpa izin.',
      status: 'live',
      claim_hash: 'hash-quar-severe',
    });

    const res = handleCreateReport(post.id, { reason: 'personal_data' }, 'anon_citizen');
    expect(res.statusCode).toBe(200);
    expect(res.data?.quarantined).toBe(true);

    const updated = db.posts.get(post.id)!;
    expect(updated.status).toBe('quarantined');
  });

  // Acceptance Criterion 3: Non-admin ditolak di semua rute /admin
  it('strictly rejects non-admin users with 403 on admin routes', () => {
    const nonAdmin = 'hacker@random.com';
    const admin = 'admin@thevoidregistry.com';

    // Get admin data
    const resGet = handleGetAdminData(nonAdmin);
    expect(resGet.statusCode).toBe(403);
    expect(resGet.error).toBe('unauthorized_admin');

    // Approve
    const resApprove = handleAdminApprove('fake-post-id', nonAdmin);
    expect(resApprove.statusCode).toBe(403);

    // Restore
    const resRestore = handleAdminRestore('fake-post-id', nonAdmin, 'Restore reason');
    expect(resRestore.statusCode).toBe(403);

    // Remove
    const resRemove = handleAdminRemove('fake-post-id', nonAdmin, 'Takedown reason');
    expect(resRemove.statusCode).toBe(403);

    // Admin email is accepted
    const resAdmin = handleGetAdminData(admin);
    expect(resAdmin.statusCode).toBe(200);
    expect(resAdmin.data).toBeDefined();
  });

  // Admin moderation workflows
  it('allows admin to approve pending post and sets expiry = approval + 24h', () => {
    const now = new Date('2026-07-01T10:00:00Z');
    const post = db.publishPost({
      kind: 'failure',
      body: 'Post yang sempat terkena filter kata kunci dan masuk antrean peninjauan.',
      status: 'pending_review',
      claim_hash: 'hash-pending-1',
      now,
    });

    const admin = 'admin@thevoidregistry.com';
    const approvalTime = new Date('2026-07-01T12:00:00Z'); // Approved 2 hours later

    const res = handleAdminApprove(post.id, admin, approvalTime);
    expect(res.statusCode).toBe(200);
    expect(res.data?.status).toBe('live');
    expect(res.data?.published_at).toBe(approvalTime.toISOString());
    expect(res.data?.expires_at).toBe(
      new Date(approvalTime.getTime() + 24 * 3600 * 1000).toISOString()
    );

    // Log verified
    const log = db.moderationLogs.find((l) => l.action === 'approve');
    expect(log).toBeDefined();
    expect(log?.actor).toBe(admin);
    expect(log?.from_status).toBe('pending_review');
    expect(log?.to_status).toBe('live');
  });

  it('requires reason when admin removes a post', () => {
    const post = db.publishPost({
      kind: 'failure',
      body: 'Post yang melanggar aturan pencemaran nama baik terang-terangan.',
      status: 'live',
      claim_hash: 'hash-rem-1',
    });

    const admin = 'admin@thevoidregistry.com';

    // Blank reason -> 400
    const resBlank = handleAdminRemove(post.id, admin, '   ');
    expect(resBlank.statusCode).toBe(400);
    expect(resBlank.error).toBe('reason_required');

    // Valid reason -> 200
    const resValid = handleAdminRemove(post.id, admin, 'Pelanggaran doxxing terbukti');
    expect(resValid.statusCode).toBe(200);
    expect(resValid.data?.status).toBe('removed');
  });
});
