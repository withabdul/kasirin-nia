# Kasirin — POS & CRM ringan

Aplikasi kasir satu toko: katalog produk (CRUD), transaksi dengan struk, dan CRM
pelanggan sederhana. Mobile-first — di layar kecil navigasinya bottom nav, dan
keranjang muncul sebagai bar di atas nav.

**Stack:** TanStack Start (React 19 + Vite 8) · TanStack Router (file-based) ·
Drizzle ORM · PostgreSQL · Bun · Nitro. Tanpa Tailwind — CSS ditulis tangan.

## Fitur

**Kasir** (`/kasir`)
- Grid produk + pencarian nama/SKU + filter kategori
- Keranjang tersimpan di `localStorage`, stok dijaga (tidak bisa oversell)
- Diskon, metode bayar (Tunai/QRIS/Transfer), hitung kembalian + tombol uang pas
- Struk siap cetak (`window.print()`), bisa dibatalkan (stok dikembalikan)

**Katalog** (`/katalog`)
- CRUD produk: nama, SKU unik, kategori, harga jual, modal, stok, satuan
- Margin otomatis di form, indikator stok menipis, aktif/nonaktif
- Tabel di desktop, list di mobile

**Pelanggan** (`/pelanggan`)
- CRUD pelanggan: kontak, tier (Basic/Silver/Gold), tag, catatan
- Total order, total belanja, kunjungan terakhir dihitung dari transaksi
- Filter tier + sortir (terbaru / paling loyal / nama)

**Laporan** (`/laporan`)
- Penjualan hari ini, rata-rata per transaksi, estimasi margin, total penjualan
- Grafik 7 hari, produk terlaris, peringatan stok menipis, transaksi terakhir

## Jalanin

```bash
bun install
cp .env.example .env.local     # isi DATABASE_URL
bun run db:push                # bikin tabel
bun run db:seed                # data contoh (kopi shop)
bun --bun run dev              # http://localhost:3000
```

`bun run db:seed --force` untuk reset data contoh.

### DATABASE_URL

Postgres-nya yang sudah jalan di server ini (`postgres`, PG18, docker network
`traefik-net`) — host diakses lewat IP container karena portnya tidak di-publish:

```
DATABASE_URL="postgresql://kasirin:<password>@172.18.0.3:5432/kasirin"
```

Kalau container di-recreate IP-nya bisa berubah — ambil ulang dengan
`docker inspect postgres --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`,
atau publish portnya (`127.0.0.1:5433:5432`) supaya bisa pakai `localhost`.

## Deploy (Docker + Traefik)

Repo ini nempel ke network Traefik yang sudah ada (`traefik-net`, external) dan
mendapat TLS lewat certresolver `letsencrypt` — pola labelnya sama dengan service
lain di server.

```bash
cp .env.example .env      # DATABASE_URL untuk container
docker compose up -d --build
```

Ganti `kasirin.${DOMAIN}` di `docker-compose.yml` kalau hostnya beda. Karena
app-nya jalan di host yang sama dengan container Postgres, `DATABASE_URL` bisa
pakai IP container di atas, atau `postgres:5432` kalau app-nya juga ikut masuk
`traefik-net` (compose di sini sudah begitu).

## Struktur

```
src/
  db/          schema Drizzle + seed
  server/      server functions (products, customers, orders, settings, shell)
  routes/      __root, index(→kasir), kasir, katalog, pelanggan, laporan
  components/  AppShell (sidebar + bottom nav), Layer (modal/sheet), Toast
  lib/         types, format (Intl id-ID, TZ Asia/Jakarta), icons (inline SVG)
  styles/      base / components / views / react — CSS custom properties
```

Catatan teknis:
- Format tanggal & angka dipatok `Asia/Jakarta` di server dan client supaya SSR
  dan hydration menghasilkan string identik.
- Harga disimpan sebagai integer rupiah; nomor struk dari kolom `serial`.
- Checkout pakai transaksi + `SELECT … FOR UPDATE` supaya stok tidak bentrok.
- `src/routes/routeTree.gen.ts` di-generate oleh TanStack Router CLI.
