// THE VOID REGISTRY - Deep AI Moderation Engine for Confessions & Failures
// Researched specifically for high-risk anonymous confessions (anti-doxxing, defamation, quasi-identifiers)

import { GoogleGenAI } from '@google/genai';
import { filterContent } from './filter.ts';

export interface AIModerationResult {
  passed: boolean;
  safeForLive: boolean;
  status: 'live' | 'pending_review' | 'rejected';
  riskScore: number; // 0.0 to 1.0
  doxxingRisk: number;
  defamationRisk: number;
  selfHarmRisk: number;
  flaggedCategories: string[];
  reasons: string[];
  feedbackToAuthor?: string;
  isCrisis?: boolean;
}

/**
 * Quasi-identifier patterns that often leak third-party identity in confessions
 */
const QUASI_IDENTIFIER_PATTERNS = [
  /\b(?:plat|nopol)\s*[a-z]{1,2}\s*\d{1,4}\s*[a-z]{1,3}\b/i, // Plat nomor kendaraan
  /\b(?:rt|rw)\s*\d{1,3}\b/i, // RT / RW detail alamat
  /\b(?:jl\.|jalan)\s+[a-z0-9\s]{3,30}(?:no|nomor)\s*\d+/i, // Alamat jalan lengkap
  /\b(?:rek|rekening)\s*(?:bca|mandiri|bni|bri|cimb|jago|dana|ovo|gopay)?\s*\d{8,16}\b/i, // Nomor rekening
];

export async function evaluateContentWithAI(
  body: string,
  kind: 'failure' | 'confession',
  options?: { skipNetwork?: boolean }
): Promise<AIModerationResult> {
  // 1. Layer 1: Heuristic hard rejects
  const baseFilter = filterContent(body);
  if (!baseFilter.passed) {
    return {
      passed: false,
      safeForLive: false,
      status: 'rejected',
      riskScore: 1.0,
      doxxingRisk: 1.0,
      defamationRisk: 0.5,
      selfHarmRisk: 0.0,
      flaggedCategories: baseFilter.hardRejects,
      reasons: baseFilter.hardRejects,
      feedbackToAuthor: 'Tulisan memuat data kontak langsung, email, URL, atau nomor identitas pribadi.',
    };
  }

  // 2. Layer 2: Quasi-identifiers scanner (specific to confessions)
  for (const pattern of QUASI_IDENTIFIER_PATTERNS) {
    if (pattern.test(body)) {
      return {
        passed: false,
        safeForLive: false,
        status: 'rejected',
        riskScore: 0.9,
        doxxingRisk: 0.95,
        defamationRisk: 0.4,
        selfHarmRisk: 0.0,
        flaggedCategories: ['quasi_identifier_doxxing'],
        reasons: ['Terdeteksi alamat spesifik, nomor plat kendaraan, atau nomor rekening.'],
        feedbackToAuthor:
          'Dilarang mencantumkan alamat spesifik, nomor plat kendaraan, atau detail rekening bank.',
      };
    }
  }

  // 3. Layer 3: Sensitive keyword matching from baseFilter
  if (baseFilter.status === 'pending_review') {
    return {
      passed: true,
      safeForLive: false,
      status: 'pending_review',
      riskScore: 0.7,
      doxxingRisk: 0.1,
      defamationRisk: 0.2,
      selfHarmRisk: baseFilter.isCrisis ? 0.9 : 0.3,
      flaggedCategories: baseFilter.flaggedCategories,
      reasons: ['Konten memuat kata kunci sensitif yang memerlukan pemeriksaan manual admin.'],
      isCrisis: baseFilter.isCrisis,
      feedbackToAuthor: baseFilter.isCrisis
        ? 'Tulisan Anda dalam peninjauan. Jika Anda membutuhkan bantuan mental, hubungi layanan 119 ekstensi 8.'
        : 'Tulisan Anda sedang ditinjau sebelum dapat tampil ke publik.',
    };
  }

  // 4. Layer 4: AI Intelligent Deep Evaluation via Gemini API (if apiKey exists)
  const apiKey = typeof process !== 'undefined' && process.env?.GEMINI_API_KEY;
  if (!options?.skipNetwork && apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
    try {
      const ai = new GoogleGenAI();
      const prompt = `Anda adalah sistem moderasi keselamatan tingkat tinggi untuk platform anonim "THE VOID REGISTRY".
Tipe konten: ${kind === 'confession' ? 'Pengakuan Rahasia (Confession)' : 'Kegagalan (Failure)'}.

Evaluasi teks berikut untuk risiko:
1. Doxxing / Witch-hunting: Menyebut inisial, ciri-ciri spesifik orang ketiga, atau institusi yang membuka identitas target nyata.
2. Defamation: Tuduhan kejahatan, perselingkuhan, korupsi tanpa dasar hukum.
3. Revenge / Pelecehan: Konten seksual non-konsensual atau balas dendam.
4. Self-harm: Keinginan menyakiti diri.

Teks untuk diperiksa:
"""${body}"""

Kembalikan respons HANYA berupa JSON valid dengan format persis:
{
  "safe_for_live": boolean,
  "doxxing_risk": number (0.0 to 1.0),
  "defamation_risk": number (0.0 to 1.0),
  "self_harm_risk": number (0.0 to 1.0),
  "feedback_to_author": string
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        const json = JSON.parse(response.text);
        const isSafe = Boolean(json.safe_for_live);
        const doxxRisk = Number(json.doxxing_risk) || 0;
        const defRisk = Number(json.defamation_risk) || 0;
        const shRisk = Number(json.self_harm_risk) || 0;

        if (!isSafe || doxxRisk > 0.6 || defRisk > 0.7 || shRisk > 0.6) {
          return {
            passed: true,
            safeForLive: false,
            status: 'pending_review',
            riskScore: Math.max(doxxRisk, defRisk, shRisk),
            doxxingRisk: doxxRisk,
            defamationRisk: defRisk,
            selfHarmRisk: shRisk,
            flaggedCategories: ['ai_detected_risk'],
            reasons: ['AI mendeteksi risiko pelanggaran privasi atau pencemaran nama baik.'],
            feedbackToAuthor:
              json.feedback_to_author ||
              'Tulisan dialihkan ke antrean peninjauan moderasi untuk memastikan anonimitas pihak terkait.',
          };
        }
      }
    } catch (aiErr) {
      // In case of transient AI error or timeout, proceed to heuristic approval
      console.warn('AI moderation fallback to heuristic rules:', aiErr);
    }
  }

  // 5. Clean & passed
  return {
    passed: true,
    safeForLive: true,
    status: 'live',
    riskScore: 0.0,
    doxxingRisk: 0.0,
    defamationRisk: 0.0,
    selfHarmRisk: 0.0,
    flaggedCategories: [],
    reasons: [],
  };
}
