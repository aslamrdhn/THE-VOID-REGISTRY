import { describe, it, expect } from 'vitest';
import { CONFIG } from '../lib/config.ts';

describe('M0 Setup - CONFIG validation', () => {
  it('should have exact values specified in PRD §6.7', () => {
    expect(CONFIG.POST_TTL_HOURS).toBe(24);
    expect(CONFIG.BODY_MIN).toBe(20);
    expect(CONFIG.BODY_MAX).toBe(1500);
    expect(CONFIG.HOT_GRAVITY).toBe(1.5);
    expect(CONFIG.FEED_PAGE_SIZE).toBe(20);
    expect(CONFIG.REPORT_QUARANTINE_THRESHOLD).toBe(3);
    expect(CONFIG.REPORT_SEVERE_THRESHOLD).toBe(1);
    expect(CONFIG.IMMORTALIZE_PRICE_IDR).toBe(20000);
    expect(CONFIG.IMMORTALIZE_MIN_RESPECT).toBe(10);
    expect(CONFIG.IMMORTALIZE_WINDOW_HOURS).toBe(6);
    expect(CONFIG.ORDER_TTL_MINUTES).toBe(15);
    expect(CONFIG.RETENTION_EXPIRED_DAYS).toBe(7);
    expect(CONFIG.RETENTION_REMOVED_DAYS).toBe(30);
  });
});
