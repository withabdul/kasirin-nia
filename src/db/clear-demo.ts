/* Bersihin semua data demo/contoh supaya toko mulai dari nol.

   Yang DIHAPUS : orders, order_items, customers, customer_notes
   Yang DIPERTAHANKAN : products (inventory asli), settings

   Sekalian set identitas toko (storeName=Rontjeu, outlet kosong) dan reset
   nomor struk balik ke INV-1001.

   Run: bun run db:clear-demo */

import { config } from 'dotenv'

config({ path: ['.env.local', '.env'] })

const { db } = await import('./index.ts')
const { customerNotes, customers, orderItems, orders, settings } =
  await import('./schema.ts')
const { sql } = await import('drizzle-orm')

async function count(table: 'orders' | 'order_items' | 'customers' | 'customer_notes' | 'products') {
  const res = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${table}`))
  const rows = (res as unknown as { rows?: { n: number }[] }).rows ?? (res as unknown as { n: number }[])
  return Number(rows[0]?.n ?? 0)
}

const TABLES = ['orders', 'order_items', 'customers', 'customer_notes', 'products'] as const

const before: Record<string, number> = {}
for (const t of TABLES) before[t] = await count(t)

console.log('Sebelum:')
for (const t of TABLES) console.log(`  ${t.padEnd(15)} ${before[t]}`)

await db.transaction(async (tx) => {
  await tx.delete(orderItems)
  await tx.delete(orders)
  await tx.delete(customerNotes)
  await tx.delete(customers)

  // nomor struk balik ke INV-1001 (nama sequence dari serial column: orders_seq_seq)
  await tx.execute(
    sql`SELECT setval(pg_get_serial_sequence('orders', 'seq'), 1, false)`,
  )

  for (const [key, value] of [
    ['storeName', 'Rontjeu'],
    ['outlet', ''],
  ] as [string, string][]) {
    await tx
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({ target: settings.key, set: { value } })
  }
})

const after: Record<string, number> = {}
for (const t of TABLES) after[t] = await count(t)

console.log('Sesudah:')
for (const t of TABLES) {
  const delta = after[t] - before[t]
  console.log(
    `  ${t.padEnd(15)} ${after[t]}${delta ? `  (${delta > 0 ? '+' : ''}${delta})` : ''}`,
  )
}

console.log(
  `\n✓ Data demo dibersihkan. Produk (${after.products}) tetap utuh, identitas toko diset ke Rontjeu.`,
)
process.exit(0)
