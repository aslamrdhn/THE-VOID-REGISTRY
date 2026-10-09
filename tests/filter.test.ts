import { describe, it, expect } from 'vitest';
import { filterContent, normalizeText, compactDigits } from '../lib/moderation/filter.ts';
import { generateClaimCode, hashClaimCode, verifyClaimCode } from '../lib/hash.ts';

describe('M2 - Content Filter & Moderation Tests', () => {
  // 1. Phone number test with various separators
  describe('Phone number rejection (contains_phone)', () => {
    it('rejects standard 08 Indonesian phone numbers', () => {
      const res = filterContent('Hubungi saya di 081234567890 untuk info lebih lanjut.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_phone');
      expect(res.status).toBe('rejected');
    });

    it('rejects phone numbers with spaces and dots', () => {
      const res = filterContent('Kontak saya di 0 8 1 2 . 3 4 5 6 . 7 8 9 0 besok pagi.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_phone');
    });

    it('rejects international +62 format with hyphens', () => {
      const res = filterContent('Bisa telepon ke +62-813-9988-7766.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_phone');
    });
  });

  // 2. Email pattern
  describe('Email rejection (contains_email)', () => {
    it('rejects emails in text', () => {
      const res = filterContent('Kirim berkas ke founder_gagal@startup.co.id segera.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_email');
    });
  });

  // 3. URLs without scheme and messengers
  describe('URL rejection (contains_url)', () => {
    it('rejects URLs without http scheme', () => {
      const res = filterContent('Silakan buka situs kami di startup-gagal.com/pitch untuk baca.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_url');
    });

    it('rejects wa.me and t.me links', () => {
      const res1 = filterContent('Hubungi admin di wa.me/628123456789 sekarang.');
      expect(res1.passed).toBe(false);
      expect(res1.hardRejects).toContain('contains_url');

      const res2 = filterContent('Grup komunitas t.me/korban_startup_indonesia.');
      expect(res2.passed).toBe(false);
      expect(res2.hardRejects).toContain('contains_url');
    });

    it('rejects bit.ly links', () => {
      const res = filterContent('Semua bukti ada di bit.ly/dokumen-rahasia silakan unduh.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_url');
    });
  });

  // 4. 16-digit ID (NIK)
  describe('16-digit ID rejection (contains_id_number)', () => {
    it('rejects contiguous 16-digit numbers', () => {
      const res = filterContent('Nomor identitas saya adalah 3171012345678901 tolong rahasiakan.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_id_number');
    });

    it('rejects spaced 16-digit numbers', () => {
      const res = filterContent('Nomor KTP dia: 3201 0234 5678 9012.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_id_number');
    });
  });

  // 5. Social handles (@name >= 3 chars)
  describe('Handle rejection (contains_handle)', () => {
    it('rejects twitter/instagram handles', () => {
      const res = filterContent('Cek akun @founder_curang dia yang bawa lari uang kas.');
      expect(res.passed).toBe(false);
      expect(res.hardRejects).toContain('contains_handle');
    });
  });

  // 6. Sensitive keywords -> pending_review
  describe('Sensitive keywords -> pending_review & crisis detection', () => {
    it('flags self_harm and marks isCrisis true', () => {
      const res = filterContent('Setelah perusahaan bangkrut saya merasa ingin bunuh diri setiap malam.');
      expect(res.passed).toBe(true);
      expect(res.status).toBe('pending_review');
      expect(res.flaggedCategories).toContain('self_harm');
      expect(res.isCrisis).toBe(true);
    });

    it('flags threat and moves to pending_review', () => {
      const res = filterContent('Saya sangat dendam kepada investor dan akan kubunuh mereka jika bertemu.');
      expect(res.passed).toBe(true);
      expect(res.status).toBe('pending_review');
      expect(res.flaggedCategories).toContain('threat');
      expect(res.isCrisis).toBe(false);
    });
  });

  // 7. Clean text -> live
  describe('Clean text validation', () => {
    it('passes clean failure post and returns status live', () => {
      const cleanBody =
        'Kami meluncurkan aplikasi tanpa load testing. Server meledak di hari pertama dan kami kehilangan 50 klien restoran. Saya harus meminta maaf satu per satu.';
      const res = filterContent(cleanBody);
      expect(res.passed).toBe(true);
      expect(res.status).toBe('live');
      expect(res.hardRejects.length).toBe(0);
      expect(res.flaggedCategories.length).toBe(0);
      expect(res.isCrisis).toBe(false);
    });
  });

  // 8. Claim code cryptography
  describe('Claim Code Cryptography (§6.5)', () => {
    it('generates claim code with correct VOID-XXXX-XXXX-XXXX-XXXX format', () => {
      const code = generateClaimCode();
      expect(code).toMatch(/^VOID-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);
    });

    it('correctly hashes and verifies claim code with constant-time equality', () => {
      const code = generateClaimCode();
      const hash = hashClaimCode(code);
      expect(verifyClaimCode(code, hash)).toBe(true);
      expect(verifyClaimCode('VOID-WRONG-CODE-0000-0000', hash)).toBe(false);
    });
  });
});
