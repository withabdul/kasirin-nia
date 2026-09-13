import { createServerFn } from '@tanstack/react-start'
import { inArray } from 'drizzle-orm'

import { db } from '../db/index.ts'
import { settings } from '../db/schema.ts'
import type { StoreSettings } from '../lib/types.ts'

const DEFAULTS: StoreSettings = {
  storeName: 'Kopi Senja',
  outlet: 'Cabang Kemang',
  cashier: 'Abdul',
  lowStockThreshold: 10,
  footer: 'Terima kasih sudah mampir :)',
}

const KEYS = Object.keys(DEFAULTS) as (keyof StoreSettings)[]

export const getSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<StoreSettings> => {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, KEYS))

    const map = new Map(rows.map((r) => [r.key, r.value]))
    return {
      storeName: map.get('storeName') ?? DEFAULTS.storeName,
      outlet: map.get('outlet') ?? DEFAULTS.outlet,
      cashier: map.get('cashier') ?? DEFAULTS.cashier,
      lowStockThreshold: Number(
        map.get('lowStockThreshold') ?? DEFAULTS.lowStockThreshold,
      ),
      footer: map.get('footer') ?? DEFAULTS.footer,
    }
  },
)

export const updateSettings = createServerFn({ method: 'POST' })
  .validator((input: Partial<StoreSettings>) => ({
    storeName: String(input.storeName ?? DEFAULTS.storeName).slice(0, 60),
    outlet: String(input.outlet ?? DEFAULTS.outlet).slice(0, 60),
    cashier: String(input.cashier ?? DEFAULTS.cashier).slice(0, 60),
    lowStockThreshold: Math.max(
      0,
      Math.round(Number(input.lowStockThreshold) || 0),
    ),
    footer: String(input.footer ?? DEFAULTS.footer).slice(0, 120),
  }))
  .handler(async ({ data }): Promise<StoreSettings> => {
    await db.transaction(async (tx) => {
      for (const key of KEYS) {
        const value = String(data[key])
        await tx
          .insert(settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: settings.key, set: { value } })
      }
    })
    return data
  })
