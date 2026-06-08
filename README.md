# Turath Chain

Frontend dan backend untuk penelusuran rantai intelektual teks Islam klasik.

UI frontend mengikuti spesifikasi di `apps/PRD/PRD_FRONTEND.md`.

## Jalankan Lokal

Pakai path yang konsisten:

`C:\Users\alawymadasaka\Documents\antigravity\frontend\Turath-Chain`

Jangan buka repo ini dari path lowercase `turath-chain`, karena Next.js di Windows bisa membaca casing path berbeda dan memunculkan warning/module mismatch.

### 1. Siapkan env

Pastikan file ini ada:

- `apps/web/.env.local`
- `apps/api/.env.local`

Minimal yang penting:

- `apps/web/.env.local`
  - `NEXTAUTH_URL=http://localhost:3000`
  - `AUTH_SECRET=...`
  - `NEXT_PUBLIC_API_URL=http://localhost:3001`
  - `GOOGLE_CLIENT_ID=...` jika ingin Google login aktif
  - `GOOGLE_CLIENT_SECRET=...` jika ingin Google login aktif
- `apps/api/.env.local`
  - `DATABASE_URL=...`
  - `PORT=3001`
  - env lain sesuai `apps/api/.env.example`

Kalau Google OAuth belum disiapkan, login email/password tetap bisa dipakai.

### 2. Install dependency

Di `apps/web`:

```powershell
pnpm install
```

Kalau `pnpm` menahan build script, jalankan:

```powershell
pnpm approve-builds
```

Lalu pilih package yang diminta.

Di `apps/api`:

```powershell
pnpm install
```

### 3. Prisma

Di `apps/api`:

```powershell
pnpm db:generate
pnpm db:migrate
```

### 4. Jalankan backend

Di `apps/api`:

```powershell
pnpm dev
```

### 5. Jalankan frontend

Di terminal baru, di `apps/web`:

```powershell
pnpm dev
```

### 6. Buka aplikasi

- Web: `http://localhost:3000`
- API: `http://localhost:3001`

## Catatan Implementasi

- Frontend memakai NextAuth v5 untuk login Google dan email/password.
- Endpoint backend yang dipakai frontend:
  - `/api/search`
  - `/api/content-search`
  - `/api/books/:id`
  - `/api/books/:id/chain`
  - `/api/saved`
  - `/api/profile`
- Sesi user dikirim ke API lewat header `x-user-id` dari NextAuth session.
- Palet frontend mengikuti PRD baru: biru, Sora, dan Noto Naskh Arabic.

## Troubleshooting

- `MissingSecret` berarti `AUTH_SECRET` atau `NEXTAUTH_SECRET` belum diisi di `apps/web/.env.local`.
- Error casing path biasanya muncul kalau repo sempat dibuka dari `Turath-Chain` dan `turath-chain` bergantian. Tutup terminal lama, buka ulang dari path yang konsisten, lalu hapus `.next` jika perlu.
- Kalau `pnpm migrate` atau Prisma minta reset karena drift, cek lagi migration lokal dan pastikan `DATABASE_URL` mengarah ke database dev yang benar.
