import { Link, useRouterState, useRouter } from '@tanstack/react-router'
import { useCallback, useState, type ReactNode } from 'react'

import { Icon } from '../lib/icons.tsx'
import { rp, initials } from '../lib/format.ts'
import type { ShellData } from '../server/shell.ts'
import { Field, Layer } from './Layer.tsx'
import { useToast } from './Toast.tsx'
import { updateSettings } from '../server/settings.ts'
import type { StoreSettings } from '../lib/types.ts'

const NAV = [
  { to: '/kasir', label: 'Kasir', icon: 'kasir' },
  { to: '/katalog', label: 'Katalog', icon: 'katalog' },
  { to: '/pelanggan', label: 'Pelanggan', icon: 'crm' },
  { to: '/laporan', label: 'Laporan', icon: 'laporan' },
] as const

export function AppShell({
  shell,
  children,
}: {
  shell: ShellData
  children: ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { storeName, outlet } = shell.settings

  const isActive = (to: string) =>
    pathname === to || pathname.startsWith(`${to}/`)
  const current = NAV.find((n) => isActive(n.to))
  const mark = initials(storeName)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="brandmark" aria-hidden="true">
            {mark}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar__store">{storeName}</div>
            <div className="sidebar__outlet">{outlet}</div>
          </div>
        </div>

        <div className="sidebar__label">Operasional</div>
        <nav className="sidebar__nav">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`navlink${isActive(item.to) ? ' is-active' : ''}`}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar__foot">
          <div className="sidebar__card">
            <div className="label">Penjualan hari ini</div>
            <div className="value num">{rp(shell.revenueToday)}</div>
            <div className="text-xs text-muted">
              {shell.todayCount} transaksi
            </div>
          </div>
          <button
            type="button"
            className="btn btn--quiet btn--block btn--sm"
            style={{ marginTop: 8 }}
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="gear" className="ico--sm" />
            Pengaturan toko
          </button>
          <a
            className="brandline"
            href="https://github.com/withabdul/kasirin-nia"
            target="_blank"
            rel="noreferrer"
          >
            <strong>Rontjeu POS</strong>
            <span>v1.0</span>
          </a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__id">
            <div className="brandmark" aria-hidden="true">
              {mark}
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="topbar__name">{current?.label ?? storeName}</div>
              <div className="topbar__sub">
                {storeName} · {outlet}
              </div>
            </div>
          </div>
          <div className="topbar__spacer" />
          <button
            type="button"
            className="icon-btn"
            aria-label="Pengaturan toko"
            onClick={() => setSettingsOpen(true)}
          >
            <Icon name="gear" />
          </button>
        </header>

        {children}

        <nav className="navbottom" aria-label="Navigasi utama">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`navbottom__item${isActive(item.to) ? ' is-active' : ''}`}
            >
              <span className="navbottom__pip" aria-hidden="true" />
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      {settingsOpen ? (
        <StoreSettingsLayer
          settings={shell.settings}
          onClose={() => setSettingsOpen(false)}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */

function StoreSettingsLayer({
  settings,
  onClose,
}: {
  settings: StoreSettings
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [form, setForm] = useState<StoreSettings>(settings)
  const [busy, setBusy] = useState(false)

  const set = useCallback(
    <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  )

  const save = async () => {
    setBusy(true)
    try {
      await updateSettings({ data: form })
      await router.invalidate()
      toast('Pengaturan disimpan')
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan', 'warn')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layer
      title="Pengaturan toko"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn btn--primary"
            type="button"
            disabled={busy}
            onClick={save}
          >
            {busy ? <span className="spin" /> : <Icon name="check" />}
            Simpan
          </button>
        </>
      }
    >
      <div className="stack stack-12">
        <Field label="Nama toko">
          <input
            className="input"
            value={form.storeName}
            onChange={(e) => set('storeName', e.target.value)}
          />
        </Field>
        <div className="field-row field-row--2">
          <Field label="Outlet">
            <input
              className="input"
              value={form.outlet}
              onChange={(e) => set('outlet', e.target.value)}
            />
          </Field>
          <Field label="Nama kasir">
            <input
              className="input"
              value={form.cashier}
              onChange={(e) => set('cashier', e.target.value)}
            />
          </Field>
        </div>
        <Field
          label="Batas stok menipis"
          hint="Produk dengan stok ≤ angka ini muncul di peringatan."
        >
          <input
            className="input input--num"
            type="number"
            min={0}
            value={form.lowStockThreshold}
            onChange={(e) =>
              set('lowStockThreshold', Number(e.target.value) || 0)
            }
          />
        </Field>
        <Field label="Catatan struk">
          <input
            className="input"
            value={form.footer}
            onChange={(e) => set('footer', e.target.value)}
          />
        </Field>
      </div>
    </Layer>
  )
}
