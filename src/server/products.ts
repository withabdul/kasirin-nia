import { createServerFn } from '@tanstack/react-start'
import { asc, eq } from 'drizzle-orm'

import { db } from '../db/index.ts'
import { products } from '../db/schema.ts'
import type { Product, ProductInput } from '../lib/types.ts'

type Row = typeof products.$inferSelect

function toProduct(row: Row): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    price: row.price,
    cost: row.cost,
    stock: row.stock,
    unit: row.unit,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  }
}

function clean(input: ProductInput): ProductInput {
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('Nama produk wajib diisi')
  const sku = String(input.sku ?? '').trim().toUpperCase()
  if (!sku) throw new Error('SKU wajib diisi')
  return {
    sku,
    name,
    category: String(input.category ?? '').trim() || 'Lainnya',
    price: Math.max(0, Math.round(Number(input.price) || 0)),
    cost: Math.max(0, Math.round(Number(input.cost) || 0)),
    stock: Math.max(0, Math.round(Number(input.stock) || 0)),
    unit: String(input.unit ?? '').trim() || 'pcs',
    active: Boolean(input.active),
  }
}

export const listProducts = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Product[]> => {
    const rows = await db
      .select()
      .from(products)
      .orderBy(asc(products.category), asc(products.name))
    return rows.map(toProduct)
  },
)

export const createProduct = createServerFn({ method: 'POST' })
  .validator((input: ProductInput) => clean(input))
  .handler(async ({ data }): Promise<Product> => {
    const dup = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, data.sku))
      .limit(1)
    if (dup.length) throw new Error(`SKU ${data.sku} sudah dipakai produk lain`)

    const [row] = await db.insert(products).values(data).returning()
    return toProduct(row)
  })

export const updateProduct = createServerFn({ method: 'POST' })
  .validator((input: { id: string; patch: ProductInput }) => ({
    id: String(input.id),
    patch: clean(input.patch),
  }))
  .handler(async ({ data }): Promise<Product> => {
    const dup = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.sku, data.patch.sku))
      .limit(1)
    if (dup.length && dup[0].id !== data.id) {
      throw new Error(`SKU ${data.patch.sku} sudah dipakai produk lain`)
    }

    const [row] = await db
      .update(products)
      .set(data.patch)
      .where(eq(products.id, data.id))
      .returning()
    if (!row) throw new Error('Produk tidak ditemukan')
    return toProduct(row)
  })

export const deleteProduct = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await db.delete(products).where(eq(products.id, data.id))
    return { ok: true }
  })
