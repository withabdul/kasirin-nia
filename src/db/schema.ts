import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

/* ------------------------------------------------------------------ *
 * Katalog
 * ------------------------------------------------------------------ */
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sku: text('sku').notNull().unique(),
    name: text('name').notNull(),
    category: text('category').notNull().default('Lainnya'),
    price: integer('price').notNull().default(0),
    cost: integer('cost').notNull().default(0),
    stock: integer('stock').notNull().default(0),
    unit: text('unit').notNull().default('pcs'),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('products_category_idx').on(t.category)],
)

/* ------------------------------------------------------------------ *
 * CRM
 * ------------------------------------------------------------------ */
export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  tier: text('tier').notNull().default('Basic'),
  tags: text('tags')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const customerNotes = pgTable(
  'customer_notes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('customer_notes_customer_idx').on(t.customerId)],
)

/* ------------------------------------------------------------------ *
 * Transaksi
 * ------------------------------------------------------------------ */
export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    seq: serial('seq').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    subtotal: integer('subtotal').notNull().default(0),
    discount: integer('discount').notNull().default(0),
    total: integer('total').notNull().default(0),
    payment: text('payment').notNull().default('Tunai'),
    paid: integer('paid').notNull().default(0),
    customerId: uuid('customer_id').references(() => customers.id, {
      onDelete: 'set null',
    }),
    customerName: text('customer_name'),
    note: text('note').notNull().default(''),
  },
  (t) => [index('orders_created_idx').on(t.createdAt)],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    sku: text('sku').notNull().default(''),
    price: integer('price').notNull().default(0),
    qty: integer('qty').notNull().default(1),
  },
  (t) => [index('order_items_order_idx').on(t.orderId)],
)

/* ------------------------------------------------------------------ *
 * Pengaturan (key/value)
 * ------------------------------------------------------------------ */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

/* ------------------------------------------------------------------ *
 * Relations
 * ------------------------------------------------------------------ */
export const ordersRelations = relations(orders, ({ many, one }) => ({
  items: many(orderItems),
  customer: one(customers, {
    fields: [orders.customerId],
    references: [customers.id],
  }),
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}))

export const customersRelations = relations(customers, ({ many }) => ({
  notes: many(customerNotes),
  orders: many(orders),
}))

export const customerNotesRelations = relations(customerNotes, ({ one }) => ({
  customer: one(customers, {
    fields: [customerNotes.customerId],
    references: [customers.id],
  }),
}))
