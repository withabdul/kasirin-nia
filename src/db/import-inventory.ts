/* Import the shop's real inventory (transcribed from the handwritten stock
   notes) and REPLACE the demo catalog with it.

   Run:  bun run db:import-inventory
         bun run db:import-inventory --dry   (lihat ringkasan, tidak menulis)

   Categories follow the rack/section headers written in the notes, because that
   is how the stock is physically organised. Item names keep the product type,
   so the cashier sees both ("Gelang Misora Serut" / "Rak Putar 1").

   Numbers in parentheses in the notes = stock quantity, not price.
   Only two prices were written down (the two kaos kaki). Everything else is
   price 0 on purpose — fill prices in Katalog instead of guessing.
*/

import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

const { db } = await import('./index.ts')
const { products } = await import('./schema.ts')
const { sql } = await import('drizzle-orm')

const DRY = process.argv.includes('--dry')

type Item = { name: string; qty: number; price?: number }

/** [category, sku prefix, items] — in the order they appear in the notes. */
const INVENTORY: [string, string, Item[]][] = [
  [
    'Rak Putar 1',
    'RP1',
    [
      { name: 'Gelang Misora Serut', qty: 12 },
      { name: 'Gelang Misora Bintang Laut', qty: 6 },
      { name: 'Jepitan Denim', qty: 6 },
      { name: 'Ganci Love Vintage', qty: 1 },
      { name: 'Gelang Manik Ceko Bunga', qty: 6 },
      { name: 'Gelang Manik Ceko Kristal', qty: 6 },
      { name: 'Ganci Pompom', qty: 6 },
      { name: 'Bros Cherry', qty: 6 },
    ],
  ],
  [
    'Di Atas Meja',
    'DM',
    [
      { name: 'Cermin Premium', qty: 7 },
      { name: 'Kaos Kaki Putih Hijau', qty: 6 },
      { name: 'Jedai Kupu Baru', qty: 6 },
      { name: 'Jedai Misora Baru', qty: 6 },
      { name: 'Kuku Palsu', qty: 27 },
      { name: 'Jedai Anggrek', qty: 5 },
      { name: 'Jedai Kupu', qty: 2 },
      { name: 'Jedai Kamboja Lama', qty: 6 },
      { name: 'Jedai Bnu Pita', qty: 3 },
      { name: 'Jedai Kotak Hijau', qty: 3 },
    ],
  ],
  [
    'Rak Susun (Rak III)',
    'R3',
    [{ name: 'Jedai Panjang Baru', qty: 8 }],
  ],
  [
    'Rak I',
    'R1',
    [
      { name: 'Scrunchie Bulu', qty: 14 },
      { name: 'Scrunchie Biasa', qty: 3 },
      { name: 'Scrunchie Kelinci', qty: 2 },
      { name: 'Scrunchie Vogue Girl', qty: 2 },
    ],
  ],
  [
    'Rak II',
    'R2',
    [
      { name: 'Dompet', qty: 4 },
      { name: 'Kacamata', qty: 10 },
      { name: 'Scrunchie Murahan / Biasa', qty: 6 },
      { name: 'Jedai Sannio', qty: 4 },
      { name: 'Set Cincin', qty: 5 },
      { name: 'Tali Rambut Bunga Ungu', qty: 1 },
      { name: 'Cermin Kawat Bulu', qty: 1 },
      { name: 'Jedai Bulu', qty: 1 },
    ],
  ],
  [
    'Rak Putar 2',
    'RP2',
    [
      { name: 'Gelang Misora Bintang Laut', qty: 5 },
      { name: 'Ganci Orang', qty: 6 },
      { name: 'Strap Misora', qty: 8 },
      { name: 'Strap Ceko', qty: 1 },
      { name: 'Ganci Karet Strap', qty: 14 },
      { name: 'Ganci Tali Ijo', qty: 3 },
      { name: 'Strap Misora Pita', qty: 5 },
      { name: 'Gelang Misora Premium', qty: 5 },
      { name: 'Ganci Padel', qty: 5 },
      { name: 'Ganci Karet Burger Dkk', qty: 7 },
      { name: 'Ganci Karet Stitch', qty: 6 },
      { name: 'Ganci Karet Pooh', qty: 1 },
      { name: 'Ganci Karet Strawberry', qty: 1 },
      { name: 'Gelang Gent Bm', qty: 1 },
      { name: 'Ganci Misora Kerang', qty: 5 },
      { name: 'Ganci Bunga Longan', qty: 4 },
      { name: 'Ganci Pita Bunga', qty: 5 },
      { name: 'Ganci Karet Bawah Laut', qty: 6 },
      { name: 'Ganci Epoxy', qty: 6 },
    ],
  ],
  [
    'Di Atas Etalase',
    'E',
    [
      { name: 'Cermin Bunga', qty: 2 },
      { name: 'Notebook Mini Hp.Is', qty: 8 },
      { name: 'Notebook Beruang Bakers', qty: 1 },
      { name: 'Notebook Epmal Atas', qty: 5 },
      { name: 'Notebook Epmal Samping', qty: 5 },
      { name: 'Jarum Pentul Mini', qty: 2 },
      { name: 'Kutek', qty: 15 },
    ],
  ],
  [
    'Rak Gantung',
    'RG',
    [
      { name: 'Gelang Semt Ikan', qty: 1 },
      { name: 'Gelang Semt Bunga Besar', qty: 5 },
      { name: 'Gelang Guyung Hijau', qty: 1 },
      { name: 'Gelang Manik Bulat Besar', qty: 2 },
      { name: 'Gelang Manik Double Layer', qty: 2 },
      { name: 'Gelang Manik Bunga Matahari', qty: 5 },
      { name: 'Gelang Hplp', qty: 1 },
      { name: 'Cermin Bulat', qty: 9 },
      { name: 'Sikat Kucing', qty: 6 },
      { name: 'Ganci Mini', qty: 8 },
    ],
  ],
  [
    'Rak Lain-lain',
    'RL',
    [
      { name: 'Besar (nama belum kebaca)', qty: 4 },
      { name: 'Kalung Strawberry', qty: 9 },
      { name: 'Kaos Kaki 12.000', qty: 5, price: 12000 },
      { name: 'Kaos Kaki Jempol', qty: 8 },
      { name: 'Kaos Kaki Anak', qty: 1 },
      { name: 'Kaos Kaki 10.000', qty: 8, price: 10000 },
      { name: 'Karet Jepang Bintang', qty: 6 },
      { name: 'Karet Jepang Ba', qty: 6 },
      { name: 'Penggaris 15 Cm', qty: 8 },
      { name: 'Sticky Notes', qty: 6 },
      { name: 'Cermin Benang', qty: 2 },
      { name: 'Tisu Basah Mini', qty: 10 },
    ],
  ],
]

const rows = INVENTORY.flatMap(([category, prefix, items]) =>
  items.map((item, i) => ({
    sku: `${prefix}-${String(i + 1).padStart(3, '0')}`,
    name: item.name,
    category,
    price: item.price ?? 0,
    cost: 0,
    stock: item.qty,
    unit: 'pcs',
    active: true,
  })),
)

const totalQty = rows.reduce((t, r) => t + r.stock, 0)

console.log(`Kategori : ${INVENTORY.length}`)
for (const [category, , items] of INVENTORY) {
  const qty = items.reduce((t, i) => t + i.qty, 0)
  console.log(
    `  ${category.padEnd(20)} ${String(items.length).padStart(2)} item · ${qty} pcs`,
  )
}
console.log(`Total    : ${rows.length} produk · ${totalQty} pcs`)
console.log(
  `Harga    : ${rows.filter((r) => r.price > 0).length} produk ada harga, ${rows.filter((r) => r.price === 0).length} masih 0`,
)

if (DRY) {
  console.log('\n(--dry) tidak ada yang ditulis ke database')
  process.exit(0)
}

const before = await db.select({ n: sql<number>`count(*)::int` }).from(products)

// DELETE (not TRUNCATE CASCADE): order_items.product_id is ON DELETE SET NULL, so
// the sales history survives with the product name intact.
await db.delete(products)
await db.insert(products).values(rows)

const after = await db.select({ n: sql<number>`count(*)::int` }).from(products)
console.log(
  `\n✓ Katalog diganti: ${before[0].n} produk lama dihapus, ${after[0].n} produk baru dimasukkan`,
)
process.exit(0)
