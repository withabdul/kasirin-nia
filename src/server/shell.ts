import { createServerFn } from '@tanstack/react-start'
import { gte, sql } from 'drizzle-orm'

import { db } from '../db/index.ts'
import { orders } from '../db/schema.ts'
import { getSettings } from './settings.ts'
import type { StoreSettings } from '../lib/types.ts'

export type ShellData = {
  settings: StoreSettings
  todayCount: number
  revenueToday: number
}

/** Light payload for the app shell: store identity + today's takings. */
export const getShell = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ShellData> => {
    const since = new Date()
    since.setHours(0, 0, 0, 0)

    const [settings, agg] = await Promise.all([
      getSettings(),
      db
        .select({
          total: sql<number>`coalesce(sum(${orders.total}), 0)::int`,
          count: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(gte(orders.createdAt, since)),
    ])

    return {
      settings,
      todayCount: Number(agg[0]?.count ?? 0),
      revenueToday: Number(agg[0]?.total ?? 0),
    }
  },
)
