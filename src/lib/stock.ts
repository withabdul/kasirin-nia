/* Stock urgency — one definition, shared by the kasir tiles, the katalog table
   and the laporan warnings, so the same product never reads two ways. */

/**
 * At or below this the shelf is down to its last sale or two. Deliberately
 * small and independent of `lowStockThreshold`: in a shop where most lines sit
 * under ten units, a threshold-sized alarm fires on nearly everything and
 * stops meaning anything. This tier stays rare, so it stays loud.
 */
export const CRITICAL_STOCK = 2

export type StockLevel = 'out' | 'critical' | 'low' | 'ok'

export function stockLevel(stock: number, lowThreshold: number): StockLevel {
  if (stock <= 0) return 'out'
  if (stock <= Math.min(CRITICAL_STOCK, lowThreshold)) return 'critical'
  if (stock <= lowThreshold) return 'low'
  return 'ok'
}
