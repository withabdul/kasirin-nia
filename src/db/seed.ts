/* Seed data — a small coffee shop.
   Run:  bun run db:seed          (keeps existing data if products exist)
         bun run db:seed --force  (truncate + reseed)                        */

import { config } from 'dotenv'
import { sql } from 'drizzle-orm'

config({ path: ['.env.local', '.env'] })

const { db } = await import('./index.ts')
const { customers, customerNotes, orderItems, orders, products, settings } =
  await import('./schema.ts')

const FORCE = process.argv.includes('--force')

const PRODUCTS = [
  { sku: 'KP-001', name: 'Kopi Susu Gula Aren', category: 'Kopi', price: 22000, cost: 9000, stock: 42, unit: 'cup' },
  { sku: 'KP-002', name: 'Es Kopi Tubruk', category: 'Kopi', price: 18000, cost: 7000, stock: 30, unit: 'cup' },
  { sku: 'KP-003', name: 'Cappuccino', category: 'Kopi', price: 28000, cost: 12000, stock: 24, unit: 'cup' },
  { sku: 'KP-004', name: 'Americano', category: 'Kopi', price: 24000, cost: 8000, stock: 8, unit: 'cup' },
  { sku: 'NK-001', name: 'Matcha Latte', category: 'Non-Kopi', price: 30000, cost: 14000, stock: 18, unit: 'cup' },
  { sku: 'NK-002', name: 'Teh Lemon Madu', category: 'Non-Kopi', price: 20000, cost: 7000, stock: 25, unit: 'cup' },
  { sku: 'NK-003', name: 'Cokelat Panas', category: 'Non-Kopi', price: 25000, cost: 10000, stock: 12, unit: 'cup' },
  { sku: 'MK-001', name: 'Croissant Butter', category: 'Makanan', price: 26000, cost: 14000, stock: 6, unit: 'pcs' },
  { sku: 'MK-002', name: 'Roti Bakar Srikaya', category: 'Makanan', price: 21000, cost: 9000, stock: 15, unit: 'pcs' },
  { sku: 'MK-003', name: 'Pisang Goreng Keju', category: 'Makanan', price: 19000, cost: 8000, stock: 20, unit: 'porsi' },
  { sku: 'SN-001', name: 'Donat Gula', category: 'Snack', price: 12000, cost: 5000, stock: 28, unit: 'pcs' },
  { sku: 'SN-002', name: 'Keripik Kentang', category: 'Snack', price: 15000, cost: 8000, stock: 0, unit: 'pcs' },
  { sku: 'SN-003', name: 'Air Mineral 600ml', category: 'Snack', price: 6000, cost: 2500, stock: 60, unit: 'botol' },
  { sku: 'MR-001', name: 'Tumbler Kasirin', category: 'Merch', price: 85000, cost: 45000, stock: 9, unit: 'pcs', active: false },
]

const CUSTOMERS = [
  { name: 'Rani Puspita', phone: '0812-3344-5566', email: 'rani@mail.com', tier: 'Gold', tags: ['langganan', 'kopi manis'], note: 'Selalu pesan kopi susu, less ice.' },
  { name: 'Bagas Wibowo', phone: '0857-9911-2233', email: 'bagas.w@mail.com', tier: 'Silver', tags: ['wfh'], note: 'Kerja remote, sering nongkrong 2-3 jam.' },
  { name: 'Dinda Ayu', phone: '0813-7788-1199', email: 'dinda.ayu@mail.com', tier: 'Gold', tags: ['event', 'bulk'], note: 'Order kantor tiap Jumat, minta invoice.' },
  { name: 'Yusuf Hidayat', phone: '0899-1122-3344', email: '', tier: 'Basic', tags: [], note: '' },
  { name: 'Clara Tanuwijaya', phone: '0878-5566-7788', email: 'clara@mail.com', tier: 'Silver', tags: ['non-kopi'], note: 'Gak minum kopi, prefer matcha.' },
  { name: 'Rio Pratama', phone: '0812-6677-8899', email: '', tier: 'Basic', tags: ['ojol'], note: 'Driver ojol, sering mampir sore.' },
]

// [daysAgo, hour, minute, [[productIndex, qty], ...], customerIndex | null]
const ORDERS: [number, number, number, [number, number][], number | null][] = [
  [0, 9, 12, [[0, 2], [10, 2]], 0],
  [0, 10, 5, [[1, 1], [12, 1]], null],
  [0, 12, 40, [[0, 4], [7, 3]], 2],
  [0, 16, 20, [[2, 1]], 1],
  [1, 9, 45, [[0, 1], [8, 1]], 0],
  [1, 13, 10, [[4, 2], [11, 1]], 4],
  [1, 15, 30, [[0, 3]], 3],
  [2, 10, 15, [[3, 1], [9, 2]], null],
  [2, 11, 50, [[0, 2], [10, 1]], 5],
  [2, 14, 25, [[5, 1], [12, 2]], 1],
  [2, 17, 5, [[1, 2], [7, 1]], 2],
  [3, 9, 30, [[0, 1], [6, 1]], 0],
  [3, 12, 0, [[4, 1], [8, 1], [10, 1]], 4],
  [3, 16, 45, [[0, 5]], 2],
  [4, 10, 20, [[2, 2]], null],
  [5, 11, 15, [[0, 2], [9, 1]], 5],
  [5, 15, 40, [[5, 2], [12, 3]], 3],
  [6, 13, 25, [[1, 1], [7, 1], [10, 1]], 1],
]

const PAYMENTS = ['Tunai', 'QRIS', 'QRIS', 'Transfer']

function at(daysAgo: number, hour: number, minute: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, minute, 0, 0)
  return d
}

const existing = await db.select({ id: products.id }).from(products).limit(1)

if (existing.length && !FORCE) {
  console.log('↷ Data sudah ada, skip seed. Pakai `bun run db:seed --force` untuk reset.')
  process.exit(0)
}

if (FORCE) {
  await db.execute(
    sql`TRUNCATE order_items, orders, customer_notes, customers, products, settings RESTART IDENTITY CASCADE`,
  )
  console.log('⌫ Tabel dikosongkan')
}

const insertedProducts = await db
  .insert(products)
  .values(
    PRODUCTS.map((p) => ({
      ...p,
      active: p.active ?? true,
      createdAt: at(30, 9, 0),
    })),
  )
  .returning()

const insertedCustomers = await db
  .insert(customers)
  .values(
    CUSTOMERS.map((c) => ({
      name: c.name,
      phone: c.phone,
      email: c.email,
      tier: c.tier,
      tags: c.tags,
      createdAt: at(40, 11, 0),
    })),
  )
  .returning()

const notes = CUSTOMERS.map((c, i) => ({ c, i })).filter((x) => x.c.note)
if (notes.length) {
  await db.insert(customerNotes).values(
    notes.map((x) => ({
      customerId: insertedCustomers[x.i].id,
      text: x.c.note,
      createdAt: at(12, 14, 5),
    })),
  )
}

for (let i = 0; i < ORDERS.length; i++) {
  const [daysAgo, hour, minute, lines, custIdx] = ORDERS[i]
  const items = lines.map(([pi, qty]) => ({
    product: insertedProducts[pi],
    qty,
  }))
  const subtotal = items.reduce((t, it) => t + it.product.price * it.qty, 0)
  const customer = custIdx === null ? null : insertedCustomers[custIdx]

  const [order] = await db
    .insert(orders)
    .values({
      createdAt: at(daysAgo, hour, minute),
      subtotal,
      discount: 0,
      total: subtotal,
      payment: PAYMENTS[i % PAYMENTS.length],
      paid: subtotal,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? null,
      note: '',
    })
    .returning()

  await db.insert(orderItems).values(
    items.map((it) => ({
      orderId: order.id,
      productId: it.product.id,
      name: it.product.name,
      sku: it.product.sku,
      price: it.product.price,
      qty: it.qty,
    })),
  )
}

await db
  .insert(settings)
  .values([
    { key: 'storeName', value: 'Kopi Senja' },
    { key: 'outlet', value: 'Cabang Kemang' },
    { key: 'cashier', value: 'Abdul' },
    { key: 'lowStockThreshold', value: '10' },
    { key: 'footer', value: 'Terima kasih sudah mampir :)' },
  ])
  .onConflictDoNothing()

console.log(
  `✓ Seed selesai: ${insertedProducts.length} produk, ${insertedCustomers.length} pelanggan, ${ORDERS.length} transaksi`,
)
process.exit(0)
