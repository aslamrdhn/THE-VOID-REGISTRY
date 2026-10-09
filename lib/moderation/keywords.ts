// THE VOID REGISTRY - Sensitive Keywords Dictionary
// Source of truth: PRD §6.2
// Matches will flag post to 'pending_review' instead of hard-rejecting

export interface SensitiveKeywords {
  self_harm: string[];
  threat: string[];
  minor: string[];
}

export const SENSITIVE_KEYWORDS: SensitiveKeywords = {
  self_harm: [
    'bunuh diri',
    'suicide',
    'mengakhiri hidup',
    'potong nadi',
    'gantung diri',
    'lompat dari gedung',
    'overdosis sengaja',
    'self harm',
    'menyakiti diri',
  ],
  threat: [
    'akan kubunuh',
    'bom',
    'tembak mati',
    'ancam santet',
    'habisi nyawanya',
    'teror',
    'serang mereka',
  ],
  minor: [
    'anak di bawah umur',
    'eksploitasi anak',
    'pedofil',
    'bocah sd telanjang',
    'anak smp mesum',
  ],
};
