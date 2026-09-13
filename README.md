# Rontjeu POS

Aplikasi kasir satu toko: katalog produk (CRUD), transaksi dengan struk, CRM
pelanggan sederhana, dan ekspor CSV. Mobile-first — di layar kecil navigasinya
bottom nav, dan keranjang muncul sebagai bar di atas nav.

**Live:** https://pos-nia.berkoding.com

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

**Ekspor CSV** — tombol "Ekspor CSV" ada di Katalog, Pelanggan, dan Laporan.
Semua ekspor lewat layer pratinjau: pilih opsi dulu, lihat jumlah baris + 3 baris
pertama, baru download.

| Halaman | Isi | Opsi |
|---|---|---|
| Katalog | SKU, nama, kategori, harga, modal, margin Rp/%, stok, satuan, status | yang tampil / semua produk, pemisah kolom |
| Pelanggan | nama, kontak, tier, tag, jumlah order, total belanja, rata-rata, kunjungan terakhir, catatan | yang tampil / semua pelanggan, pemisah kolom |
| Laporan | transaksi (kode, tanggal, jam, pelanggan, metode, item, subtotal, diskon, total, dibayar, kembalian) **atau** per-item (SKU, produk, qty, harga, jumlah) | rentang (hari ini / 7 / 30 hari / semua), baris per transaksi atau per item, pemisah kolom |

Detail teknis ekspor:
- Angka ditulis polos (`22000`, bukan `Rp22.000`) supaya bisa langsung dijumlah
  di spreadsheet; satuan rupiah ada di nama kolomnya.
- UTF-8 BOM disertakan agar Excel di Windows tidak merusak karakter Indonesia.
- Pemisah kolom bisa dipilih: koma (standar) atau titik koma (Excel dengan
  regional Indonesia).
- Nama file: `rontjeu-transaksi-2026-09-13.csv`.
- Kutipan mengikuti RFC 4180, line ending CRLF.

## Jalanin

```bash
bun install
cp .env.example .env.local     # isi DATABASE_URL
bun run db:push                # bikin tabel
bun run db:import-inventory    # isi katalog dari catatan stok toko
bun --bun run dev              # http://localhost:3000
```

`bun run db:import-inventory` untuk isi katalog, `bun run db:clear-demo` untuk
mulai dari nol (hapus transaksi + pelanggan, produk tetap).
Build + jalankan mode produksi lokal: `bun run build && bun run start`.

### Katalog

Isi katalog berasal dari catatan stok tulis tangan pemilik toko, di-transkrip ke
`src/db/import-inventory.ts` (79 produk, 9 seksi rak, 426 pcs).

```bash
bun run db:import-inventory --dry   # lihat ringkasan, tidak menulis
bun run db:import-inventory         # ganti katalog dengan isi catatan
```

Kategori = nama rak/seksi persis seperti di catatan (Rak Putar 1, Di Atas Meja,
Rak I/II, Rak Putar 2, Di Atas Etalase, Rak Gantung, Rak Susun (Rak III),
Rak Lain-lain), karena begitulah stok ditata fisik. Nama produk sudah memuat
jenisnya, jadi kasir dapat dua petunjuk: "Gelang Misora Serut" di "Rak Putar 1".

Angka dalam tanda kurung di catatan = **jumlah stok**, bukan harga. Harga hanya
tertulis untuk dua item (Kaos Kaki 12.000 dan 10.000); sisanya `0` dan diisi
lewat Katalog — bukan ditebak.

`db:clear-demo` untuk mengosongkan transaksi + pelanggan (mulai dari nol) tanpa
menyentuh katalog — sekaligus mengembalikan nomor struk ke INV-1001.

Import inventory memakai `DELETE` bukan `TRUNCATE CASCADE`, supaya riwayat
transaksi lama tetap tersimpan (nama produk di `order_items` tidak hilang).

### DATABASE_URL

Postgres-nya yang sudah jalan di server ini (`postgres`, PG18, docker network
`traefik-net`) — host diakses lewat IP container karena portnya tidak di-publish:

```
DATABASE_URL="postgresql://rontjeu:<password>@172.18.0.3:5432/rontjeu"
```

Kalau container di-recreate IP-nya bisa berubah — ambil ulang dengan
`docker inspect postgres --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'`,
atau publish portnya (`127.0.0.1:5433:5432`) supaya bisa pakai `localhost`.

## Deploy (Docker + Traefik)

**Live:** https://pos-nia.berkoding.com (Traefik → container `rontjeu-pos:3000`,
TLS via Cloudflare di depan origin).

Nempel ke network Traefik yang sudah ada (`traefik-net`, external) dan dapat TLS
lewat certresolver `letsencrypt` — pola labelnya sama dengan service lain di server.

```bash
cp .env.example .env      # DATABASE_URL + DOMAIN
docker compose up -d --build
```

Karena app-nya ikut masuk `traefik-net`, `DATABASE_URL` cukup pakai hostname
container Postgres: `postgresql://rontjeu:<password>@postgres:5432/rontjeu`.

Ganti `Host(...)` di `docker-compose.yml` kalau domainnya beda. Cek statusnya:

```bash
docker compose ps
docker logs rontjeu-pos --tail 20
curl -sS -o /dev/null -w '%{http_code}\n' https://pos-nia.berkoding.com/kasir
```

Runtime-nya Node, jadi build **wajib** pakai preset Nitro `node-server`
(`"build": "NITRO_PRESET=node-server vite build"`). Kalau di-build lewat
`bun run build` tanpa preset itu, Nitro mendeteksi Bun dan meng-output entry
`Bun.serve` yang langsung crash di `node .output/server/index.mjs`.

## Struktur

```
src/
  db/          schema Drizzle + seed
  server/      server functions (products, customers, orders, settings, shell)
  routes/      __root, index(→kasir), kasir, katalog, pelanggan, laporan
  components/  AppShell (sidebar + bottom nav), Layer (modal/sheet), Toast,
               ExportCsv (layer pratinjau + download)
  lib/         types, format (Intl id-ID, TZ Asia/Jakarta), csv, icons (inline SVG)
  styles/      base / components / views / react — CSS custom properties
```

Catatan teknis:
- Format tanggal & angka dipatok `Asia/Jakarta` di server dan client supaya SSR
  dan hydration menghasilkan string identik.
- Harga disimpan sebagai integer rupiah; nomor struk dari kolom `serial`.
- Checkout pakai transaksi + `SELECT … FOR UPDATE` supaya stok tidak bentrok.
- Ekspor CSV dibikin di client dari data loader — tidak ada endpoint tambahan.
- `src/routes/routeTree.gen.ts` di-generate oleh TanStack Router CLI.
