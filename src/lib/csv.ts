/* CSV export helpers.
   - RFC-4180 quoting, CRLF line endings
   - a UTF-8 BOM so Excel on Windows doesn't mangle Indonesian text
   - numbers go out raw (22000, not "Rp22.000") so spreadsheets can sum them
   - separator is selectable because Excel with id-ID regional settings expects `;` */

const BOM = '\uFEFF'

const TZ = 'Asia/Jakarta'

const ymd = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const hm = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export type CsvSeparator = ',' | ';'

export const SEPARATORS: { value: CsvSeparator; label: string }[] = [
  { value: ',', label: 'Koma (,) — standar' },
  { value: ';', label: 'Titik koma (;) — Excel ID' },
]

/** YYYY-MM-DD HH:mm in store timezone — sorts correctly in a spreadsheet. */
export function csvDate(iso: string | Date): string {
  const d = new Date(iso)
  return `${ymd.format(d)} ${hm.format(d)}`
}

/** YYYY-MM-DD, handy for filenames. */
export function csvStamp(iso: string | Date = new Date()): string {
  return ymd.format(new Date(iso))
}

function cell(value: unknown, sep: string): string {
  const s = value === null || value === undefined ? '' : String(value)
  const mustQuote =
    s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')
  const escaped = s.replace(/"/g, '""')
  return mustQuote ? `"${escaped}"` : escaped
}

export function buildCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  sep: CsvSeparator = ',',
): string {
  const lines = [headers, ...rows].map((row) =>
    row.map((c) => cell(c, sep)).join(sep),
  )
  return lines.join('\r\n') + '\r\n'
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([BOM + content], {
    type: 'text/csv;charset=utf-8;',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** `rontjeu-transaksi-2026-09-13.csv` */
export function csvFilename(prefix: string, iso?: string): string {
  return `rontjeu-${prefix}-${csvStamp(iso)}.csv`
}

export function joinTags(tags: string[] | undefined | null): string {
  return (tags ?? []).join(', ')
}
