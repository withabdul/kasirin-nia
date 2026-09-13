/* Inline icon set — one shared 24×24 grid, 1.7 stroke. No icon font, no emoji. */

const PATHS: Record<string, string> = {
  kasir:
    'M4 8h16l1.2 11.2A2 2 0 0 1 19.2 21H4.8a2 2 0 0 1-2-2.2L4 8Zm4-1V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7',
  katalog:
    'M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-11Zm0 4.5h16M9.5 4v17',
  crm: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16 14.6c2.9.3 5.5 2.1 5.5 4.9',
  laporan: 'M4 20V4m0 16h16M8 20v-6m4 6V8m4 12v-9',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm6-2 4 4',
  trash:
    'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13',
  edit: 'M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Zm11-13 3 3',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 13l4.5 4.5L19 7',
  cart: 'M3 4h2.2l2.3 11.2a1.5 1.5 0 0 0 1.5 1.2h8.7a1.5 1.5 0 0 0 1.5-1.1L21 8H6',
  phone: 'M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 5.5 5.5L16 12l4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z',
  mail: 'M3 6.5h18v11H3v-11Zm0 .5 9 6 9-6',
  note: 'M5 4h9l5 5v11H5V4Zm9 0v5h5',
  alert: 'M12 4 2.5 20h19L12 4Zm0 6v5m0 3h.01',
  chevron: 'M9 6l6 6-6 6',
  up: 'M7 14l5-5 5 5',
  down: 'M7 10l5 5 5-5',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6',
  gear: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8-3.5a8 8 0 0 0-.14-1.5l2.1-1.6-2-3.5-2.5 1a8 8 0 0 0-2.6-1.5L14.5 2h-4l-.36 2.9a8 8 0 0 0-2.6 1.5l-2.5-1-2 3.5 2.1 1.6a8 8 0 0 0 0 3l-2.1 1.6 2 3.5 2.5-1a8 8 0 0 0 2.6 1.5l.36 2.9h4l.36-2.9a8 8 0 0 0 2.6-1.5l2.5 1 2-3.5-2.1-1.6c.09-.49.14-1 .14-1.5Z',
  refresh: 'M20 11a8 8 0 1 0-.9 4M20 4v7h-7',
  box: 'M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9Zm8.5 5L20.5 8M12 12.5 3.5 8M12 21v-8.5',
  users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 9c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5',
  wallet:
    'M3 7.5A2.5 2.5 0 0 1 5.5 5h11A2.5 2.5 0 0 1 19 7.5v1H5.5A2.5 2.5 0 0 0 3 11v6a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-7a1 1 0 0 0-1-1H5.5M17 13.5h.01',
  printer:
    'M7 9V4h10v5M7 19H5a2 2 0 0 1-2-2v-5h18v5a2 2 0 0 1-2 2h-2m-12 0v-4h12v6H7v-2Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.5 2',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-14v2m0 18v-2M3 12h2m14 0h2M5.6 5.6l1.4 1.4m10 10 1.4 1.4m0-12.8-1.4 1.4m-10 10-1.4 1.4',
  spark: 'M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8m0-11.4-2.8 2.8m-5.8 5.8-2.8 2.8',
}

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  className,
  strokeWidth = 1.7,
}: {
  name: string
  className?: string
  strokeWidth?: number
}) {
  const d = PATHS[name] ?? ''
  return (
    <svg
      className={`ico ${className ?? ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
