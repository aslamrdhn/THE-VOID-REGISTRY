# THE VOID REGISTRY — THE FAILURE ARCHIVE

> Situs anonim tanpa akun tempat orang menulis kegagalan nyata yang otomatis musnah dalam 24 jam.

---

## 1. Arsitektur & Tech Stack
- **Framework:** React + Vite + TypeScript (Full-Stack architecture)
- **Styling:** Tailwind CSS (tema Brutalis hitam pitch `#000000`, monospace JetBrains Mono, border 2px solid, border-radius 0)
- **Database & Storage:** Supabase PostgreSQL + Row Level Security (RLS aktif tanpa policy publik)
- **State Machine:** Menegakkan transisi ketat (§6.1: `pending_review`, `live`, `quarantined`, `removed`, `expired`)
- **Moderasi Otomatis:** Regex normalization NFKC, compacting digit, penolakan no HP, email, URL, NIK 16-digit, @handle, serta flagging krisis self-harm (119 ext 8)
- **Kriptografi:** Kode klaim 128-bit (`VOID-XXXX-XXXX-XXXX-XXXX`) dengan penyimpanan HANYA hash SHA-256 (`claim_hash`)
- **Pembayaran:** QRIS via `PaymentProvider` interface (Midtrans sandbox ready, biaya Rp 20.000)
- **Ekspor Gambar:** `html-to-image` client-side untuk membuat kartu Insta-Story resolusi tinggi

---

## 2. Setup & Lingkungan Lokal

### Prasyarat
- Node.js >= 18
- npm

### Menjalankan Aplikasi
```bash
# Instal dependensi
npm install

# Jalankan pengujian unit & integrasi
npm test

# Periksa lint & typecheck
npm run lint
npm run typecheck

# Jalankan dev server lokal
npm run dev
```

Aplikasi dapat diakses di `http://localhost:3000`.

---

## 3. Variabel Lingkungan (`.env`)

Lihat `.env.example`:
```env
APP_URL="http://localhost:3000"
SITE_NAME="THE VOID REGISTRY"

# Supabase (Server Only)
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""

# Cryptography (Server Only, >= 32 byte secret)
HASH_SECRET="change-this-to-a-secure-32-byte-secret-key-hmac"

# Upstash Redis
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# Cloudflare Turnstile
NEXT_PUBLIC_TURNSTILE_SITE_KEY=""
TURNSTILE_SECRET_KEY=""

# Admin Allowlist
ADMIN_EMAILS="admin@thevoidregistry.com"

# Feature Flags
FEATURE_CONFESSION="false"
FEATURE_PAYMENTS="true"

# Payments
PAYMENT_PROVIDER="midtrans"
PAYMENT_SERVER_KEY=""
PAYMENT_WEBHOOK_SECRET=""
```

---

## 4. Migrasi Database & SQL Functions

Eksekusi migrasi Supabase di direktori `supabase/migrations/`:
1. `0001_init.sql` — Tabel `posts`, `respects`, `reports`, `moderation_log`, `orders`, `webhook_events`, enums, dan RLS.
2. `0002_functions.sql` — Fungsi atomik:
   - `publish_post`: Memasukkan tulisan baru, mengatur `expires_at = now + 24h` jika live.
   - `approve_post`: Menyetujui antrean peninjauan, jam mulai dihitung dari saat disetujui.
   - `cast_respect`: Reaksi Respect dedup unik per voter hash.
   - `file_report`: Karantina otomatis pada 1 laporan berat atau 3 laporan umum.
   - `apply_paid_order`: Idempoten, mengubah status tulisan ke abadi atau menghasilkan `refund_required` jika tulisan tidak live.
   - `expire_posts`: Mengubah tulisan yang lewat 24 jam menjadi expired (kecuali immortal).
   - `purge_posts`: Menghapus fisik setelah 7 hari (expired), 30 hari (removed), 12 bulan (audit log).
   - `expire_orders`: Mengubah order pending yang lewat 15 menit menjadi expired.

### Konfigurasi pg_cron
```sql
select cron.schedule('expire-posts',  '*/5 * * * *', $$select expire_posts()$$);
select cron.schedule('expire-orders', '*/5 * * * *', $$select expire_orders()$$);
select cron.schedule('purge-posts',   '17 3 * * *',  $$select purge_posts()$$);
```

---

## 5. Asumsi & Kebijakan (Assumptions)
1. **Prinsip Kebenaran Waktu:** Seluruh query feed memfilter secara ketat `status = 'live' AND (is_immortal OR expires_at > now())`. Kedaluwarsa terjadi tepat waktu secara otomatis tanpa bergantung pada cron.
2. **Kerahasiaan Penulis:** Alamat IP tidak pernah disimpan di Postgres, hanya hash pendek di memori/Redis untuk rate limit.
3. **Data Dev Seed:** Data contoh awal di dev berlabel `[CONTOH DEV]` dan tidak pernah di-seed ke database produksi.
