import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, gte, inArray, sql } from 'drizzle-orm'

import { db } from '../db/index.ts'
import { customers, orderItems, orders, products } from '../db/schema.ts'
import { dayKey } from '../lib/format.ts'
import type { CheckoutInput, Order, OrderItem, Stats } from '../lib/types.ts'
import { getSettings } from './settings.ts'

const CODE_BASE = 1000

function toOrder(
  row: typeof orders.$inferSelect,
  items: (typeof orderItems.$inferSelect)[],
): Order {
  return {
    id: row.id,
    code: `INV-${CODE_BASE + row.seq}`,
    createdAt: row.createdAt.toISOString(),
    subtotal: row.subtotal,
    discount: row.discount,
    total: row.total,
    payment: row.payment,
    paid: row.paid,
    customerId: row.customerId,
    customerName: row.customerName,
    note: row.note,
    items: items.map(
      (it): OrderItem => ({
        id: it.id,
        productId: it.productId,
        name: it.name,
        sku: it.sku,
        price: it.price,
        qty: it.qty,
      }),
    ),
  }
}

async function hydrate(orderRows: (typeof orders.$inferSelect)[]) {
  if (!orderRows.length) return [] as Order[]
  const itemRows = await db
    .select()
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        orderRows.map((o) => o.id),
      ),
    )
  return orderRows.map((o) =>
    toOrder(
      o,
      itemRows.filter((it) => it.orderId === o.id),
    ),
  )
}

export const listOrders = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Order[]> => {
    const rows = await db
      .select()
      .from(orders)
      .orderBy(desc(orders.createdAt))
      .limit(200)
    return hydrate(rows)
  },
)

export const checkout = createServerFn({ method: 'POST' })
  .validator((input: CheckoutInput) => {
    const items = (input.items ?? []).filter((it) => Number(it.qty) > 0)
    if (!items.length) throw new Error('Keranjang masih kosong')
    return {
      items: items.map((it) => ({
        productId: String(it.productId),
        qty: Math.max(1, Math.round(Number(it.qty))),
      })),
      discount: Math.max(0, Math.round(Number(input.discount) || 0)),
      payment: String(input.payment || 'Tunai'),
      paid: Math.max(0, Math.round(Number(input.paid) || 0)),
      customerId: input.customerId ? String(input.customerId) : null,
      note: String(input.note ?? '').slice(0, 300),
    }
  })
  .handler(async ({ data }): Promise<Order> => {
    const ids = data.items.map((it) => it.productId)

    return db.transaction(async (tx) => {
      // Lock the rows we are about to decrement so concurrent tills can't
      // oversell the same stock.
      const rows = await tx
        .select()
        .from(products)
        .where(inArray(products.id, ids))
        .for('update')

      const byId = new Map(rows.map((r) => [r.id, r]))
      const lines = data.items.map((it) => {
        const product = byId.get(it.productId)
        if (!product) throw new Error('Produk tidak ditemukan')
        return { product, qty: it.qty }
      })

      const subtotal = lines.reduce(
        (t, l) => t + l.product.price * l.qty,
        0,
      )
      const discount = Math.min(data.discount, subtotal)
      const total = subtotal - discount

      let customerName: string | null = null
      let customerId: string | null = null
      if (data.customerId) {
        const found = await tx.query.customers.findFirst({
          where: (c, { eq: e }) => e(c.id, data.customerId as string),
        })
        if (found) {
          customerId = found.id
          customerName = found.name
        }
      }

      const [order] = await tx
        .insert(orders)
        .values({
          subtotal,
          discount,
          total,
          payment: data.payment,
          paid: data.paid || total,
          customerId,
          customerName,
          note: data.note,
        })
        .returning()

      const inserted = await tx
        .insert(orderItems)
        .values(
          lines.map((l) => ({
            orderId: order.id,
            productId: l.product.id,
            name: l.product.name,
            sku: l.product.sku,
            price: l.product.price,
            qty: l.qty,
          })),
        )
        .returning()

      for (const line of lines) {
        await tx
          .update(products)
          .set({ stock: Math.max(0, line.product.stock - line.qty) })
          .where(eq(products.id, line.product.id))
      }

      return toOrder(order, inserted)
    })
  })

export const deleteOrder = createServerFn({ method: 'POST' })
  .validator((input: { id: string }) => ({ id: String(input.id) }))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    await db.transaction(async (tx) => {
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, data.id))

      // void → put the stock back
      for (const it of items) {
        if (!it.productId) continue
        await tx
          .update(products)
          .set({ stock: sql`${products.stock} + ${it.qty}` })
          .where(eq(products.id, it.productId))
      }
      await tx.delete(orders).where(eq(orders.id, data.id))
    })
    return { ok: true }
  })

export const getStats = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Stats> => {
    const cfg = await getSettings()

    const since = new Date(Date.now() - 8 * 86_400_000)

    const [recentRows, windowRows, allAgg, topRows, productRows] =
      await Promise.all([
        db
          .select()
          .from(orders)
          .orderBy(desc(orders.createdAt))
          .limit(6),
        db.select().from(orders).where(gte(orders.createdAt, since)),
        db
          .select({
            total: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(orders),
        db
          .select({
            name: orderItems.name,
            qty: sql<number>`sum(${orderItems.qty})::int`,
            revenue: sql<number>`sum(${orderItems.qty} * ${orderItems.price})::int`,
          })
          .from(orderItems)
          .groupBy(orderItems.name)
          .orderBy(desc(sql`sum(${orderItems.qty})`))
          .limit(5),
        db.select().from(products).orderBy(asc(products.stock)),
      ])

    const [customerAgg] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)

    const today = dayKey(new Date())
    const windowOrders = await hydrate(windowRows)

    const todayOrders = windowOrders.filter(
      (o) => dayKey(o.createdAt) === today,
    )

    const series = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() - (6 - i) * 86_400_000)
      const key = dayKey(d)
      const total = windowOrders
        .filter((o) => dayKey(o.createdAt) === key)
        .reduce((t, o) => t + o.total, 0)
      return {
        key,
        date: d.toISOString(),
        label: d.toLocaleDateString('id-ID', {
          weekday: 'short',
          timeZone: 'Asia/Jakarta',
        }),
        total,
      }
    })

    const costById = new Map(productRows.map((p) => [p.id, p.cost]))
    const marginToday = todayOrders.reduce(
      (sum, o) =>
        sum +
        o.items.reduce(
          (s, it) =>
            s + (it.price - (costById.get(it.productId ?? '') ?? 0)) * it.qty,
          0,
        ),
      0,
    )
    const revenueToday = todayOrders.reduce((t, o) => t + o.total, 0)

    return {
      todayCount: todayOrders.length,
      revenueToday,
      revenueAll: Number(allAgg[0]?.total ?? 0),
      basket: todayOrders.length ? revenueToday / todayOrders.length : 0,
      marginToday,
      series,
      top: topRows.map((r) => ({
        name: r.name,
        qty: Number(r.qty),
        revenue: Number(r.revenue),
      })),
      lowStock: productRows
        .filter((p) => p.active && p.stock <= cfg.lowStockThreshold)
        .map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          price: p.price,
          cost: p.cost,
          stock: p.stock,
          unit: p.unit,
          active: p.active,
          createdAt: p.createdAt.toISOString(),
        })),
      recent: await hydrate(recentRows),
      productCount: productRows.length,
      customerCount: Number(customerAgg?.count ?? 0),
    }
  })
