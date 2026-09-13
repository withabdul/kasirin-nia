import { createFileRoute, Link } from '@tanstack/react-router'

import { ExportCsvButton } from '../components/ExportCsv.tsx'
import { csvDate, csvFilename, SEPARATORS } from '../lib/csv.ts'
import { dateTime, dayKey, num, relDay, rp } from '../lib/format.ts'
import { Icon } from '../lib/icons.tsx'
import { getStats, listOrders } from '../server/orders.ts'
import { getSettings } from '../server/settings.ts'

const RANGES = [
  { value: 'today', label: 'Hari ini' },
  { value: '7', label: '7 hari terakhir' },
  { value: '30', label: '30 hari terakhir' },
  { value: 'all', label: 'Semua transaksi' },
]

export const Route = createFileRoute('/laporan')({
  loader: async () => {
    const [stats, settings, orders] = await Promise.all([
      getStats(),
      getSettings(),
      listOrders(),
    ])
    return { stats, settings, orders }
  },
  component: LaporanPage,
})

function LaporanPage() {
  const { stats, settings, orders } = Route.useLoaderData()

  const maxSeries = Math.max(1, ...stats.series.map((s) => s.total))
  const maxTop = Math.max(1, ...stats.top.map((t) => t.qty))
  const todayKey = stats.series[stats.series.length - 1]?.key

  return (
    <div className="view is-active">
      <div className="pagehead">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 className="pagehead__title">Laporan</h1>
            <p className="pagehead__desc">
              Ringkasan {settings.storeName} · {settings.outlet}
            </p>
          </div>
          <ExportCsvButton
            title="Ekspor transaksi"
            options={[
              {
                key: 'range',
                label: 'Rentang waktu',
                defaultValue: '7',
                choices: RANGES,
              },
              {
                key: 'detail',
                label: 'Baris',
                defaultValue: 'order',
                choices: [
                  { value: 'order', label: 'Satu baris per transaksi' },
                  { value: 'item', label: 'Satu baris per item' },
                ],
                hint: 'Mode per item enak buat analisis produk.',
              },
              {
                key: 'separator',
                label: 'Pemisah kolom',
                defaultValue: ',',
                choices: SEPARATORS,
              },
            ]}
            build={(v) => {
              const todayK = dayKey(new Date())
              const span =
                v.range === '7' ? 7 : v.range === '30' ? 30 : null
              const list = orders.filter((o) => {
                if (v.range === 'all') return true
                if (v.range === 'today') return dayKey(o.createdAt) === todayK
                return (
                  Date.now() - new Date(o.createdAt).getTime() <=
                  (span as number) * 86_400_000
                )
              })
              const rangeLabel =
                RANGES.find((r) => r.value === v.range)?.label ?? ''

              if (v.detail === 'item') {
                const rows: (string | number)[][] = []
                for (const o of list) {
                  for (const it of o.items) {
                    rows.push([
                      o.code,
                      csvDate(o.createdAt),
                      it.sku,
                      it.name,
                      it.qty,
                      it.price,
                      it.qty * it.price,
                      o.customerName ?? '',
                      o.payment,
                    ])
                  }
                }
                return {
                  filename: csvFilename('transaksi-item'),
                  headers: [
                    'Kode',
                    'Waktu',
                    'SKU',
                    'Produk',
                    'Qty',
                    'Harga Satuan (Rp)',
                    'Jumlah (Rp)',
                    'Pelanggan',
                    'Metode',
                  ],
                  rows,
                  summary: `${list.length} transaksi · ${rangeLabel}`,
                }
              }

              return {
                filename: csvFilename('transaksi'),
                headers: [
                  'Kode',
                  'Tanggal',
                  'Jam',
                  'Pelanggan',
                  'Metode',
                  'Item',
                  'Subtotal (Rp)',
                  'Diskon (Rp)',
                  'Total (Rp)',
                  'Dibayar (Rp)',
                  'Kembalian (Rp)',
                  'Catatan',
                ],
                rows: list.map((o) => {
                  const [d, t] = csvDate(o.createdAt).split(' ')
                  return [
                    o.code,
                    d,
                    t,
                    o.customerName ?? '',
                    o.payment,
                    o.items.map((i) => `${i.qty}x ${i.name}`).join('; '),
                    o.subtotal,
                    o.discount,
                    o.total,
                    o.paid,
                    Math.max(0, o.paid - o.total),
                    o.note,
                  ]
                }),
                summary: `${list.length} transaksi · ${rangeLabel}`,
              }
            }}
          />
        </div>
      </div>

      <div className="tiles">
        <div className="tile tile--accent">
          <div className="tile__k">
            <Icon name="wallet" className="ico--sm" />
            Penjualan hari ini
          </div>
          <div className="tile__v">{rp(stats.revenueToday)}</div>
          <div className="tile__d">{stats.todayCount} transaksi</div>
        </div>
        <div className="tile">
          <div className="tile__k">
            <Icon name="cart" className="ico--sm" />
            Rata-rata / transaksi
          </div>
          <div className="tile__v">{rp(stats.basket)}</div>
          <div className="tile__d">Nilai keranjang hari ini</div>
        </div>
        <div className="tile">
          <div className="tile__k">
            <Icon name="up" className="ico--sm" />
            Estimasi margin hari ini
          </div>
          <div className="tile__v">{rp(stats.marginToday)}</div>
          <div className="tile__d">
            {stats.revenueToday > 0
              ? `${((stats.marginToday / stats.revenueToday) * 100).toFixed(0)}% dari penjualan`
              : 'Belum ada penjualan'}
          </div>
        </div>
        <div className="tile">
          <div className="tile__k">
            <Icon name="box" className="ico--sm" />
            Total penjualan
          </div>
          <div className="tile__v">{rp(stats.revenueAll)}</div>
          <div className="tile__d">
            {stats.productCount} produk · {stats.customerCount} pelanggan
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card__head">
            <div>
              <div className="card__title">7 hari terakhir</div>
              <div className="card__sub">
                Penjualan harian, hari ini disorot
              </div>
            </div>
            <div style={{ flex: 1 }} />
            <span className="pill pill--accent">
              {rp(stats.series.reduce((t, s) => t + s.total, 0))}
            </span>
          </div>
          <div className="card__body">
            <div className="chart">
              {stats.series.map((s) => (
                <div
                  key={s.key}
                  className={`chart__col${s.key === todayKey ? ' is-today' : ''}`}
                  title={`${s.key}: ${rp(s.total)}`}
                >
                  <div
                    className="chart__bar"
                    style={{
                      height: `${Math.max(3, (s.total / maxSeries) * 100)}%`,
                    }}
                  >
                    <span className="chart__val">{num(s.total / 1000)}k</span>
                  </div>
                  <span className="chart__cap">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stack stack-12">
          <div className="card">
            <div className="card__head">
              <div className="card__title">Produk terlaris</div>
              <div style={{ flex: 1 }} />
              <span className="card__sub">sepanjang waktu</span>
            </div>
            {stats.top.length === 0 ? (
              <div className="empty" style={{ padding: '26px 18px' }}>
                <p className="empty__title">Belum ada penjualan</p>
              </div>
            ) : (
              <div className="toplist">
                {stats.top.map((t, i) => (
                  <div className="toprow" key={t.name}>
                    <span className="toprow__rank">{i + 1}</span>
                    <span className="toprow__name">{t.name}</span>
                    <span className="toprow__meta">{t.qty}×</span>
                    <span
                      className="bar"
                      style={{ width: 56 }}
                      aria-hidden="true"
                    >
                      <span
                        style={{ width: `${(t.qty / maxTop) * 100}%` }}
                      />
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card__head">
              <div className="card__title">Stok menipis</div>
              <div style={{ flex: 1 }} />
              <span className="card__sub">
                ≤ {settings.lowStockThreshold} unit
              </span>
            </div>
            {stats.lowStock.length === 0 ? (
              <div className="empty" style={{ padding: '26px 18px' }}>
                <span className="empty__mark">
                  <Icon name="check" />
                </span>
                <p className="empty__title">Semua stok aman</p>
              </div>
            ) : (
              <div>
                {stats.lowStock.map((p) => (
                  <div className="rowitem" key={p.id}>
                    <span className="prodthumb">{p.sku.slice(-3)}</span>
                    <div className="rowitem__main">
                      <div className="rowitem__title">{p.name}</div>
                      <div className="rowitem__meta">{p.category}</div>
                    </div>
                    <span
                      className={`pill ${p.stock <= 0 ? 'pill--danger' : 'pill--warn'}`}
                    >
                      {p.stock <= 0 ? 'habis' : `${p.stock} ${p.unit}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="card__foot">
              <Link to="/katalog" className="btn btn--ghost btn--sm">
                <Icon name="box" className="ico--sm" />
                Kelola katalog
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ paddingBottom: 20 }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card__head">
            <div className="card__title">Transaksi terakhir</div>
            <div style={{ flex: 1 }} />
            <Link to="/kasir" className="sec__link">
              Buka kasir
            </Link>
          </div>
          {stats.recent.length === 0 ? (
            <div className="empty" style={{ padding: '30px 18px' }}>
              <span className="empty__mark">
                <Icon name="receipt" />
              </span>
              <p className="empty__title">Belum ada transaksi</p>
              <p className="empty__desc">
                Transaksi pertama akan muncul di sini setelah kamu bayar di
                kasir.
              </p>
            </div>
          ) : (
            stats.recent.map((o) => (
              <div className="rowitem" key={o.id}>
                <span className="avatar avatar--sm">
                  <Icon name="receipt" className="ico--sm" />
                </span>
                <div className="rowitem__main">
                  <div className="rowitem__title">
                    <span className="num">{o.code}</span>
                    {o.customerName ? ` · ${o.customerName}` : ''}
                  </div>
                  <div className="rowitem__meta">
                    <span>{relDay(o.createdAt)}</span>
                    <span>·</span>
                    <span>{dateTime(o.createdAt).split(' · ')[1]}</span>
                    <span>·</span>
                    <span>{o.payment}</span>
                    <span>·</span>
                    <span>
                      {o.items.reduce((t, it) => t + it.qty, 0)} item
                    </span>
                  </div>
                </div>
                <div className="rowitem__right">
                  <div className="rowitem__amt num">{rp(o.total)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
