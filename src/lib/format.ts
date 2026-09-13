/* Formatting helpers — pure, and timezone-pinned so SSR and the client
   produce byte-identical strings (no hydration mismatches). */

export const TZ = 'Asia/Jakarta'
const LOCALE = 'id-ID'

const nf = new Intl.NumberFormat(LOCALE)
const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function rp(n: number | string): string {
  return 'Rp' + nf.format(Math.round(Number(n) || 0))
}

export function num(n: number | string): string {
  return nf.format(Number(n) || 0)
}

/** YYYY-MM-DD in store timezone — same value on server and client. */
export function dayKey(d: Date | string): string {
  return dayFmt.format(new Date(d))
}

export function dateLong(iso: string | Date): string {
  return new Date(iso).toLocaleDateString(LOCALE, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  })
}

export function timeShort(iso: string | Date): string {
  return new Date(iso)
    .toLocaleTimeString(LOCALE, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: TZ,
    })
    .replace('.', ':')
}

export function dateTime(iso: string | Date): string {
  return `${dateLong(iso)} · ${timeShort(iso)}`
}

export function relDay(iso: string | Date): string {
  const d = new Date(iso)
  const now = new Date()
  const a = dayKey(d)
  const b = dayKey(now)
  const y = new Date()
  y.setDate(y.getDate() - 1)
  if (a === b) return 'Hari ini'
  if (a === dayKey(y)) return 'Kemarin'
  const diff = Math.round((now.getTime() - d.getTime()) / 86_400_000)
  if (diff > 0 && diff < 7) return `${diff} hari lalu`
  return dateLong(iso)
}

export function initials(name: string): string {
  return (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

export function digitsOnly(s: string): string {
  return String(s ?? '').replace(/[^\d]/g, '')
}
