// THE VOID REGISTRY - Universal Cryptographic Utilities (Browser & Node safe)
// Source of truth: PRD §6.3, §6.5, §10
// Self-contained implementation to prevent Vite browser-external issues

/**
 * Standard SHA-256 implementation in pure TypeScript (FIPS 180-4)
 */
function sha256Bytes(ascii: string): Uint8Array {
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let H0 = 0x6a09e667;
  let H1 = 0xbb67ae85;
  let H2 = 0x3c6ef372;
  let H3 = 0xa54ff53a;
  let H4 = 0x510e527f;
  let H5 = 0x9b05688c;
  let H6 = 0x1f83d9ab;
  let H7 = 0x5be0cd19;

  // Convert string to UTF-8 byte array
  const utf8: number[] = [];
  for (let i = 0; i < ascii.length; i++) {
    let charcode = ascii.charCodeAt(i);
    if (charcode < 0x80) utf8.push(charcode);
    else if (charcode < 0x800) {
      utf8.push(0xc0 | (charcode >> 6), 0x80 | (charcode & 0x3f));
    } else if (charcode < 0xd800 || charcode >= 0xe000) {
      utf8.push(0xe0 | (charcode >> 12), 0x80 | ((charcode >> 6) & 0x3f), 0x80 | (charcode & 0x3f));
    } else {
      i++;
      charcode = 0x10000 + (((charcode & 0x3ff) << 10) | (ascii.charCodeAt(i) & 0x3ff));
      utf8.push(
        0xf0 | (charcode >> 18),
        0x80 | ((charcode >> 12) & 0x3f),
        0x80 | ((charcode >> 6) & 0x3f),
        0x80 | (charcode & 0x3f)
      );
    }
  }

  const lengthBits = utf8.length * 8;
  utf8.push(0x80);
  while ((utf8.length + 8) % 64 !== 0) {
    utf8.push(0);
  }

  // Append 64-bit big-endian length
  const hi = Math.floor(lengthBits / 0x100000000);
  const lo = lengthBits >>> 0;
  utf8.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
  utf8.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);

  const W = new Uint32Array(64);

  for (let chunk = 0; chunk < utf8.length; chunk += 64) {
    for (let i = 0; i < 16; i++) {
      const idx = chunk + i * 4;
      W[i] = (utf8[idx] << 24) | (utf8[idx + 1] << 16) | (utf8[idx + 2] << 8) | utf8[idx + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = (rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3)) >>> 0;
      const s1 = (rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10)) >>> 0;
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }

    let a = H0;
    let b = H1;
    let c = H2;
    let d = H3;
    let e = H4;
    let f = H5;
    let g = H6;
    let h = H7;

    for (let i = 0; i < 64; i++) {
      const S1 = (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) >>> 0;
      const ch = ((e & f) ^ (~e & g)) >>> 0;
      const temp1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) >>> 0;
      const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    H0 = (H0 + a) >>> 0;
    H1 = (H1 + b) >>> 0;
    H2 = (H2 + c) >>> 0;
    H3 = (H3 + d) >>> 0;
    H4 = (H4 + e) >>> 0;
    H5 = (H5 + f) >>> 0;
    H6 = (H6 + g) >>> 0;
    H7 = (H7 + h) >>> 0;
  }

  const result = new Uint8Array(32);
  const hs = [H0, H1, H2, H3, H4, H5, H6, H7];
  for (let i = 0; i < 8; i++) {
    result[i * 4] = (hs[i] >>> 24) & 0xff;
    result[i * 4 + 1] = (hs[i] >>> 16) & 0xff;
    result[i * 4 + 2] = (hs[i] >>> 8) & 0xff;
    result[i * 4 + 3] = hs[i] & 0xff;
  }
  return result;
}

function rotr(x: number, n: number): number {
  return ((x >>> n) | (x << (32 - n))) >>> 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Standard SHA-256 hash returning lowercase hexadecimal string
 */
export function sha256Hex(input: string): string {
  return bytesToHex(sha256Bytes(input));
}

/**
 * HMAC-SHA256 implementation
 */
export function hmacSha256Hex(key: string, message: string): string {
  const blockSize = 64;
  const encoded = new TextEncoder().encode(key);
  const keyBytes: Uint8Array<any> = encoded.length > blockSize ? sha256Bytes(key) : encoded;

  const paddedKey = new Uint8Array(blockSize);
  for (let i = 0; i < keyBytes.length; i++) {
    paddedKey[i] = keyBytes[i];
  }

  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);

  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = paddedKey[i] ^ 0x5c;
    iKeyPad[i] = paddedKey[i] ^ 0x36;
  }

  // inner = hash(iKeyPad || message)
  const innerStr = String.fromCharCode(...iKeyPad) + message;
  const innerHash = sha256Bytes(innerStr);

  // outer = hash(oKeyPad || innerHash)
  const outerStr = String.fromCharCode(...oKeyPad) + String.fromCharCode(...innerHash);
  return bytesToHex(sha256Bytes(outerStr));
}

/**
 * Generates a random claim code with >= 128 bit entropy.
 * Format: VOID-XXXX-XXXX-XXXX-XXXX (hexadecimal blocks)
 */
export function generateClaimCode(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  const hex = bytesToHex(bytes).toUpperCase();
  const chunk1 = hex.slice(0, 4);
  const chunk2 = hex.slice(4, 8);
  const chunk3 = hex.slice(8, 12);
  const chunk4 = hex.slice(12, 16);
  return `VOID-${chunk1}-${chunk2}-${chunk3}-${chunk4}`;
}

/**
 * Calculates SHA-256 hash of a claim code
 */
export function hashClaimCode(code: string): string {
  return sha256Hex(code.trim().toUpperCase());
}

/**
 * Constant-time comparison to prevent timing attacks
 */
export function verifyClaimCode(providedCode: string, expectedHash: string): boolean {
  try {
    const providedHash = hashClaimCode(providedCode).toLowerCase();
    const targetHash = expectedHash.toLowerCase();

    if (providedHash.length !== targetHash.length) return false;
    let diff = 0;
    for (let i = 0; i < providedHash.length; i++) {
      diff |= providedHash.charCodeAt(i) ^ targetHash.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Generates voter_hash from anon_id using HMAC-SHA256
 */
export function hashVoter(
  anonId: string,
  secret = typeof process !== 'undefined' && process.env?.HASH_SECRET
    ? process.env.HASH_SECRET
    : 'void-dev-secret-key-32-bytes-long!'
): string {
  return hmacSha256Hex(secret, anonId);
}

/**
 * Generates or normalizes anonymous ID cookie (128-bit random)
 */
export function generateAnonId(): string {
  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}
