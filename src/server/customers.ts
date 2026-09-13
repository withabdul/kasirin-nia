import { createServerFn } from '@tanstack/react-start'
import { desc, eq, sql } from 'drizzle-orm'

import { db } from '../db/index.ts'
import { customerNotes, customers, orders } from '../db/schema.ts'
import type { Customer, CustomerInput } from '../lib/types.ts'

function clean(input: CustomerInput): CustomerInput {
  const name = String(input.name ?? '').trim()
  if (!name) throw new Error('Nama pelanggan wajib diisi')
  return {
    name,
    phone: String(input.phone ?? '').trim(),
    email: String(input.email ?? '').trim(),
    tier: ['Basic', 'Silver', 'Gold'].includes(input.tier) ? input.tier : 'Basic',
    tags: (Array.isArray(input.tags) ? input.tags : [])
      .map((t) => String(t).trim())
      .filter(Boolean)
      .slice(0, 6),
  }
}

export const listCustomers = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Customer[]> => {
    const [rows, notes, agg] = await Promise.all([
      db.select().from(customers).orderBy(desc(customers.createdAt)),
      db
        .select()
        .from(customerNotes)
        .orderBy(desc(customerNotes.createdAt)),
      db
        .select({
          customerId: orders.customerId,
          total: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
          count: sql<number>`count(*)::int`,
          last: sql<Date | null>`max(${orders.createdAt})`,
        })
        .from(orders)
        .groupBy(orders.customerId),
    ])

    const byCustomer = new Map(
      agg
        .filter((a) => a.customerId)
        .map((a) => [
          a.customerId as string,
          { total: Number(a.total), count: Number(a.count), last: a.last },
        ]),
    )

    return rows.map((row) => {
      const stat = byCustomer.get(row.id)
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        tier: row.tier,
        tags: row.tags,
        createdAt: row.createdAt.toISOString(),
        notes: notes
          .filter((n) => n.customerId === row.id)
          .map((n) => ({
            id: n.id,
            text: n.text,
            createdAt: n.createdAt.toISOString(),
          })),
        orderCount: stat?.count ?? 0,
        totalSpent: stat?.total ?? 0,
        lastOrderAt: stat?.last ? new Date(stat.last).toISOString() : null,
      }
    })
  },
)

export const createCustomer = createServerFn({ method: 'POST' })
  .validator((input: CustomerInput) => clean(input))
  .handler(async ({ data }): Promise<{ id: string }> => {
    const [row] = await db.insert(customers).values(data).returning()
    return { id: row.id }
  })

export const updateCustomer = createServerFn({ method: 'POST' })
  .validator((input: { id: string; patch: CustomerInput }) => ({
    id: String(input.id),
    patch: clean(input.patch),
  }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await db
      .update(customers)
      .set(data.patch)
      .where(eq(customers.id, data.id))
    return { ok: true }
  })

export const deleteCustomer = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await db.delete(customers).where(eq(customers.id, data.id))
    return { ok: true }
  })

export const addCustomerNote = createServerFn({ method: 'POST' })
  .validator((input: { customerId: string; text: string }) => {
    const text = String(input.text ?? '').trim()
    if (!text) throw new Error('Catatan kosong')
    return { customerId: String(input.customerId), text }
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await db.insert(customerNotes).values(data)
    return { ok: true }
  })

export const deleteCustomerNote = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await db.delete(customerNotes).where(eq(customerNotes.id, data.id))
    return { ok: true }
  })
