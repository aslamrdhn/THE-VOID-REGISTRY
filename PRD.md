# PRD — THE VOID REGISTRY (MVP, siap vibe coding & deploy)

> Versi 1.0 · Dokumen ini adalah sumber kebenaran tunggal untuk AI coding agent.
> Bahasa UI: Indonesia. Bahasa kode & nama tabel: Inggris.

---

## 0. Ringkasan satu paragraf

THE VOID REGISTRY adalah situs anonim tanpa akun tempat orang menulis **kegagalan** (dan nanti: rahasia) yang **otomatis hilang dalam 24 jam**. Pembaca memberi satu jenis reaksi: **Respect**. Satu-satunya hal yang bisa dibeli di MVP adalah **menyelamatkan tulisan dari kehancuran** (Immortalize, Rp20.000 via QRIS) setelah tulisan terbukti disukai. Tidak ada komentar, tidak ada profil, tidak ada login publik.

**Hipotesis yang diuji MVP:** orang mau menulis kegagalan jujur di tempat yang sepi-histori, dan sebagian kecil penulis mau membayar untuk menyelamatkan tulisan yang viral.

---

## 1. Tujuan & metrik

| Metrik | Target 30 hari pertama | Cara ukur |
|---|---|---|
| Tulisan terbit / hari | ≥ 15 | `posts` per hari |
| Tulisan yang dapat ≥ 1 Respect | ≥ 60% | `respect_count > 0` |
| Penulis yang melihat penawaran Immortalize lalu klik bayar | ≥ 5% | event `immortalize_offer_view` → `checkout_created` |
| Checkout → paid | ≥ 40% | `orders` |
| Laporan per 100 tulisan | < 10 | `reports` / `posts` |
| Pengunjung kembali dalam 7 hari | ≥ 20% | analytics privasi-friendly (tanpa cookie pihak ketiga) |

Keputusan lanjut/berhenti: jika setelah 30 hari **tidak ada satu pun** pembayaran Immortalize dari ≥ 500 tulisan terbit, hipotesis monetisasi gagal; evaluasi sebelum membangun fitur lain.

**Prasyarat peluncuran (non-kode):** kumpulkan 30–50 tulisan nyata dari kontributor yang setuju (teman, komunitas founder) *sebelum* dibuka ke publik. **Jangan seed dengan tulisan karangan yang tampil seolah nyata** — itu menipu pengguna dan merusak kepercayaan.

---

## 2. Scope

### P0 — wajib ada saat deploy
1. Halaman utama dengan dua pintu (Failure aktif; Confession terkunci lewat feature flag).
2. Kirim tulisan Failure (tanpa akun) + filter konten otomatis + **claim code**.
3. Feed: tab **HOT**, **BARU**, **HALL OF FAME**, dengan hitung mundur real-time.
4. Reaksi **Respect** (1 per perangkat per tulisan).
5. Tombol **Laporkan** + karantina otomatis + **panel admin moderasi**.
6. Kedaluwarsa otomatis (24 jam sejak terbit) + penghapusan sesuai retensi.
7. Halaman hukum: Aturan, Syarat, Privasi, Kontak takedown.
8. Gerbang 18+ ringan.
9. Rate limit & proteksi dasar penyalahgunaan.

### P1 — dibangun dalam rilis yang sama bila memungkinkan (di balik `FEATURE_PAYMENTS`)
10. **Immortalize** via QRIS (sandbox dulu, live setelah approval penyedia pembayaran).
11. Kartu gambar untuk Insta-Story (html-to-image, client-side).
12. Cloudflare Turnstile pada kirim tulisan.
13. Rekonsiliasi order otomatis + daftar refund di admin.

### P2 — backlog (jangan dibangun sekarang)
Spotlight berbayar (slot atas berlabel jelas), peluncuran jalur Confession, Midnight Moshpit versi opt-in, Karma Ledger (Tuntut/Ampuni, **tanpa** fitur bayar-untuk-reset), blur-wall dengan penguncian di server, merchandise opt-in, analitik agregat (dengan minimisasi data), form banding.

### Sengaja DIBUANG (jangan diimplementasikan, apa pun alasannya)
| Ide asli | Alasan dibuang |
|---|---|
| Bayar untuk **melewati moderasi** | Konten berbayar jadi satu-satunya yang tidak diperiksa padahal tayang paling atas. Filter berlaku untuk semua. |
| **Beli Pengampunan** (bayar untuk reset skor negatif) | Menciptakan insentif pemerasan oleh massa. |
| **Tactical Blackout berbayar** (bayar untuk mengintip nama yang disensor) | Platform menjual pembukaan identitas; risiko pencemaran nama baik. Sensor, jika ada, permanen. |
| Blur-wall sisi klien | Teks sudah terkirim ke browser; bisa dibuka lewat inspect element. |
| `device_id` fingerprint | Menggerus klaim anonim, rapuh, dan bermasalah secara privasi. Diganti claim code. |
| Antrean moderasi buatan 3–5 hari | Hambatan buatan yang terasa palsu. Filter otomatis berjalan instan. |

---

## 3. Aturan wajib untuk AI coding agent

1. Implementasikan **hanya** yang ada di PRD ini. Jika ada yang ambigu, tulis asumsi di `README.md` bagian "Assumptions" lalu lanjut; jangan menambah fitur.
2. **Semua akses database lewat server** (Route Handler / Server Component / Express Server API). Browser tidak pernah memegang kunci Supabase yang bisa menulis. RLS aktif di semua tabel **tanpa policy publik**.
3. Semua harga, ambang, dan durasi berasal dari satu file `lib/config.ts` (lihat §6.7). Tidak ada angka ajaib di komponen.
4. **Jangan** log isi tulisan, claim code, atau IP mentah.
5. Tidak ada `dangerouslySetInnerHTML`. Isi tulisan selalu teks polos.
6. Validasi semua input dengan **Zod** di sisi server, termasuk batas panjang.
7. Waktu selalu disimpan UTC (`timestamptz`); countdown dihitung dari `expires_at` absolut + selisih jam server (`server_now` di respons).
8. Tulis test (Vitest) minimal untuk: filter konten, transisi status, skor HOT, idempotensi webhook.
9. Satu commit per milestone (§12). Jalankan `npm run lint && npm run typecheck && npm test` sebelum commit.
10. Detail API penyedia pembayaran **harus dibaca dari dokumentasi resmi penyedia** — jangan menebak format signature atau endpoint.

---

## 4. Tech stack & arsitektur

| Lapisan | Pilihan | Catatan |
|---|---|---|
| Framework | **Vite React + Express (Node/TSX)** | Port 3000, modular routing, clean API |
| Styling | **Tailwind CSS** | Tema kustom brutalis (§5) |
| Font | **JetBrains Mono** | Monospace brutalis |
| Database | **Supabase Postgres** | RLS on, tanpa policy; akses via service role di server saja |
| Validasi | **Zod** | |
| Rate limit | **Upstash Redis** (`@upstash/ratelimit`) | Serverless/Express-safe; kunci memakai hash IP, TTL pendek |
| Captcha | **Cloudflare Turnstile** | P1, pada kirim tulisan |
| Pembayaran | **QRIS via penyedia berizin** (Midtrans atau Xendit — pilih satu, lihat §15) | Bungkus di interface `PaymentProvider` |
| Admin auth | **Supabase Auth (magic link)** + allowlist `ADMIN_EMAILS` | Hanya admin; publik tanpa auth |
| Job terjadwal | **Supabase `pg_cron`** | Housekeeping |
| Gambar share | **html-to-image** | client-side |
| Test | **Vitest** | |

**Prinsip kebenaran data:** feed dan halaman tulisan **selalu** memfilter `status = 'live' AND (is_immortal OR expires_at > now())`. Cron hanya untuk housekeeping; kebenaran tampilan tidak boleh bergantung pada cron.

---

## 5. UX & visual spec

**Karakter:** buku harian rahasia di ruang bawah tanah digital. Tidak ceria, tidak ada login sosial, tidak ada profil.

### Token visual
```
--bg: #000000        --fg: #E6E6E6      --muted: #7A7A7A
--line: #E6E6E6      --danger: #FF1E1E  --ok: #3DDC84 (hanya untuk status sukses)
border: 2px solid var(--line); border-radius: 0; text-transform: uppercase pada tombol
font: JetBrains Mono, semua teks
```
Tidak ada gradient, bayangan lembut, atau animasi dekoratif selain: blink pada countdown < 1 jam dan efek *glitch* ringan pada kartu yang baru dikarantina (opsional).

---

## 6. Aturan produk

### 6.7 `lib/config.ts` (semua parameter dapat diubah)

```ts
export const CONFIG = {
  POST_TTL_HOURS: 24,
  BODY_MIN: 20, BODY_MAX: 1500,
  HOT_GRAVITY: 1.5,                 // baseline; WAJIB bisa diubah, belum final
  FEED_PAGE_SIZE: 20,
  REPORT_QUARANTINE_THRESHOLD: 3,
  REPORT_SEVERE_THRESHOLD: 1,
  IMMORTALIZE_PRICE_IDR: 20000,
  IMMORTALIZE_MIN_RESPECT: 10,
  IMMORTALIZE_WINDOW_HOURS: 6,      // tombol muncul saat sisa waktu ≤ ini
  ORDER_TTL_MINUTES: 15,
  RETENTION_EXPIRED_DAYS: 7,
  RETENTION_REMOVED_DAYS: 30,
} as const;
```

---

## 14. Variabel lingkungan

```
SITE_NAME=THE VOID REGISTRY
SITE_URL=http://localhost:3000
SUPABASE_URL=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server only
HASH_SECRET=                        # ≥ 32 byte acak; server only
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
TURNSTILE_SECRET_KEY=
ADMIN_EMAILS=a@contoh.com,b@contoh.com
FEATURE_CONFESSION=false
FEATURE_PAYMENTS=false
PAYMENT_PROVIDER=midtrans
PAYMENT_SERVER_KEY=                 # sesuai penyedia; server only
PAYMENT_WEBHOOK_SECRET=             # sesuai penyedia; server only
```
