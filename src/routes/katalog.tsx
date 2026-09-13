import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Field, Layer, useConfirm } from '../components/Layer.tsx'
import { ExportCsvButton } from '../components/ExportCsv.tsx'
import { useToast } from '../components/Toast.tsx'
import { csvFilename, SEPARATORS } from '../lib/csv.ts'
import { rp } from '../lib/format.ts'
import { Icon } from '../lib/icons.tsx'
import type { Product, ProductInput } from '../lib/types.ts'
import {
  createProduct,
  deleteProduct,
  listProducts,
  updateProduct,
} from '../server/products.ts'
import { getSettings } from '../server/settings.ts'

export const Route = createFileRoute('/katalog')({
  loader: async () => {
    const [products, settings] = await Promise.all([
      listProducts(),
      getSettings(),
    ])
    return { products, settings }
  },
  component: KatalogPage,
})

const EMPTY: ProductInput = {
  sku: '',
  name: '',
  category: '',
  price: 0,
  cost: 0,
  stock: 0,
  unit: 'pcs',
  active: true,
}

type Draft = { id: string | null; form: ProductInput }

function KatalogPage() {
  const { products, settings } = Route.useLoaderData()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'Semua' | 'Aktif' | 'Nonaktif' | 'Menipis'>(
    'Semua',
  )
  const [draft, setDraft] = useState<Draft | null>(null)

  const categories = useMemo(
    () => Array.from(new Set(products.map((p) => p.category))).sort(),
    [products],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (filter === 'Aktif' && !p.active) return false
      if (filter === 'Nonaktif' && p.active) return false
      if (filter === 'Menipis' && p.stock > settings.lowStockThreshold)
        return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      )
    })
  }, [products, query, filter, settings.lowStockThreshold])

  const openNew = () =>
    setDraft({
      id: null,
      form: { ...EMPTY, category: categories[0] ?? 'Lainnya' },
    })

  const openEdit = (p: Product) =>
    setDraft({
      id: p.id,
      form: {
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: p.price,
        cost: p.cost,
        stock: p.stock,
        unit: p.unit,
        active: p.active,
      },
    })

  const remove = async (p: Product) => {
    const ok = await confirm({
      title: `Hapus ${p.name}?`,
      message:
        'Produk hilang dari katalog. Riwayat transaksi lama tetap tersimpan.',
    })
    if (!ok) return
    try {
      await deleteProduct({ data: { id: p.id } })
      await router.invalidate()
      toast('Produk dihapus')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus', 'warn')
    }
  }

  const toggleActive = async (p: Product) => {
    try {
      await updateProduct({
        data: {
          id: p.id,
          patch: {
            sku: p.sku,
            name: p.name,
            category: p.category,
            price: p.price,
            cost: p.cost,
            stock: p.stock,
            unit: p.unit,
            active: !p.active,
          },
        },
      })
      await router.invalidate()
      toast(p.active ? `${p.name} dinonaktifkan` : `${p.name} diaktifkan`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan', 'warn')
    }
  }

  const maxStock = Math.max(1, ...products.map((p) => p.stock))

  const stockCell = (p: Product) => {
    const cls =
      p.stock <= 0
        ? 'bar--danger'
        : p.stock <= settings.lowStockThreshold
          ? 'bar--warn'
          : 'bar--ok'
    return (
      <div className="stockcell">
        <span
          className="stockcell__n"
          style={{
            color:
              p.stock <= 0
                ? 'var(--danger)'
                : p.stock <= settings.lowStockThreshold
                  ? 'var(--warn)'
                  : undefined,
          }}
        >
          {p.stock} {p.unit}
        </span>
        <div className={`bar ${cls}`}>
          <span style={{ width: `${Math.max(4, (p.stock / maxStock) * 100)}%` }} />
        </div>
      </div>
    )
  }

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
            <h1 className="pagehead__title">Katalog</h1>
            <p className="pagehead__desc">
              {products.length} produk · {visible.length} tampil
            </p>
          </div>
          <ExportCsvButton
            title="Ekspor katalog"
            options={[
              {
                key: 'scope',
                label: 'Data yang diekspor',
                defaultValue: 'shown',
                choices: [
                  { value: 'shown', label: `Yang tampil (${visible.length})` },
                  { value: 'all', label: `Semua produk (${products.length})` },
                ],
              },
              {
                key: 'separator',
                label: 'Pemisah kolom',
                defaultValue: ',',
                choices: SEPARATORS,
              },
            ]}
            build={(v) => {
              const list = v.scope === 'shown' ? visible : products
              return {
                filename: csvFilename('katalog'),
                headers: [
                  'SKU',
                  'Nama Produk',
                  'Kategori',
                  'Harga Jual (Rp)',
                  'Harga Modal (Rp)',
                  'Margin (Rp)',
                  'Margin (%)',
                  'Stok',
                  'Satuan',
                  'Status',
                ],
                rows: list.map((p) => [
                  p.sku,
                  p.name,
                  p.category,
                  p.price,
                  p.cost,
                  p.price - p.cost,
                  p.price > 0
                    ? Number((((p.price - p.cost) / p.price) * 100).toFixed(1))
                    : 0,
                  p.stock,
                  p.unit,
                  p.active ? 'Aktif' : 'Nonaktif',
                ]),
                summary:
                  v.scope === 'shown'
                    ? `${visible.length} produk hasil filter`
                    : `${products.length} produk di katalog`,
              }
            }}
          />
          <button className="btn btn--primary" type="button" onClick={openNew}>
            <Icon name="plus" />
            Produk baru
          </button>
        </div>
      </div>

      <div className="catalogbar">
        <div className="search">
          <Icon name="search" />
          <input
            className="input"
            type="search"
            placeholder="Cari nama, SKU, kategori…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="catalogbar">
        <div className="chiprow" style={{ margin: 0, padding: 0 }}>
          {(['Semua', 'Aktif', 'Nonaktif', 'Menipis'] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`chip${filter === f ? ' is-active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="empty">
          <span className="empty__mark">
            <Icon name="box" />
          </span>
          <p className="empty__title">Belum ada produk di filter ini</p>
          <p className="empty__desc">
            Ubah filter atau tambahkan produk baru ke katalog.
          </p>
          <div className="empty__action">
            <button className="btn btn--primary" type="button" onClick={openNew}>
              <Icon name="plus" />
              Produk baru
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* mobile: rows */}
          <div className="wrap only-mobile">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {visible.map((p) => (
                <div className="rowitem" key={p.id}>
                  <span className="prodthumb">{p.sku.slice(-3)}</span>
                  <button
                    type="button"
                    className="rowitem__main"
                    onClick={() => openEdit(p)}
                    style={{ textAlign: 'left' }}
                  >
                    <div className="rowitem__title">
                      {p.name}
                      {!p.active ? (
                        <span className="pill" style={{ marginLeft: 8 }}>
                          nonaktif
                        </span>
                      ) : null}
                    </div>
                    <div className="rowitem__meta">
                      <span>{p.category}</span>
                      <span>·</span>
                      <span className="num">{p.sku}</span>
                    </div>
                  </button>
                  <div className="rowitem__right">
                    <div className="rowitem__amt num">{rp(p.price)}</div>
                    <div className="text-xs text-muted num">
                      {p.stock} {p.unit}
                    </div>
                  </div>
                  <button
                    className="icon-btn icon-btn--sm"
                    type="button"
                    aria-label={`Edit ${p.name}`}
                    onClick={() => openEdit(p)}
                  >
                    <Icon name="edit" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* desktop: table */}
          <div className="wrap only-desktop">
            <div className="card" style={{ overflow: 'hidden' }}>
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Produk</th>
                      <th>Kategori</th>
                      <th className="ta-r">Harga</th>
                      <th className="ta-r">Modal</th>
                      <th>Stok</th>
                      <th style={{ width: 108 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                            }}
                          >
                            <span className="prodthumb">{p.sku.slice(-3)}</span>
                            <div>
                              <div style={{ fontWeight: 600 }}>{p.name}</div>
                              <div className="text-xs text-muted num">
                                {p.sku}
                                {!p.active ? ' · nonaktif' : ''}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="pill">{p.category}</span>
                        </td>
                        <td className="ta-r num" style={{ fontWeight: 600 }}>
                          {rp(p.price)}
                        </td>
                        <td className="ta-r num text-muted">{rp(p.cost)}</td>
                        <td>{stockCell(p)}</td>
                        <td>
                          <div
                            style={{
                              display: 'flex',
                              gap: 2,
                              justifyContent: 'flex-end',
                            }}
                          >
                            <button
                              className="icon-btn icon-btn--sm"
                              type="button"
                              aria-label="Aktif/nonaktif"
                              title={p.active ? 'Nonaktifkan' : 'Aktifkan'}
                              onClick={() => toggleActive(p)}
                            >
                              <Icon name={p.active ? 'check' : 'close'} />
                            </button>
                            <button
                              className="icon-btn icon-btn--sm"
                              type="button"
                              aria-label={`Edit ${p.name}`}
                              onClick={() => openEdit(p)}
                            >
                              <Icon name="edit" />
                            </button>
                            <button
                              className="icon-btn icon-btn--sm icon-btn--danger"
                              type="button"
                              aria-label={`Hapus ${p.name}`}
                              onClick={() => remove(p)}
                            >
                              <Icon name="trash" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {draft ? (
        <ProductFormLayer
          draft={draft}
          categories={categories}
          onClose={() => setDraft(null)}
          onSaved={async (msg) => {
            setDraft(null)
            await router.invalidate()
            toast(msg)
          }}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
function ProductFormLayer({
  draft,
  categories,
  onClose,
  onSaved,
}: {
  draft: Draft
  categories: string[]
  onClose: () => void
  onSaved: (message: string) => void | Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<ProductInput>(draft.form)
  const [busy, setBusy] = useState(false)
  const editing = draft.id !== null

  const set = <K extends keyof ProductInput>(key: K, value: ProductInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const margin = form.price - form.cost
  const marginPct = form.price > 0 ? (margin / form.price) * 100 : 0

  const save = async () => {
    if (!form.name.trim()) {
      toast('Nama produk wajib diisi', 'warn')
      return
    }
    if (!form.sku.trim()) {
      toast('SKU wajib diisi', 'warn')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await updateProduct({ data: { id: draft.id as string, patch: form } })
      } else {
        await createProduct({ data: form })
      }
      await onSaved(editing ? 'Produk diperbarui' : 'Produk ditambahkan')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan', 'warn')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layer
      title={editing ? 'Edit produk' : 'Produk baru'}
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
      <div className="stack stack-16">
        <Field label="Nama produk">
          <input
            className="input"
            value={form.name}
            placeholder="cth. Kopi Susu Gula Aren"
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <div className="field-row field-row--2">
          <Field label="SKU" hint="Kode unik produk.">
            <input
              className="input input--num"
              value={form.sku}
              placeholder="KP-005"
              onChange={(e) => set('sku', e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Kategori">
            <input
              className="input"
              value={form.category}
              list="kategori-list"
              placeholder="Kopi"
              onChange={(e) => set('category', e.target.value)}
            />
            <datalist id="kategori-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>

        <div className="field-row field-row--2">
          <Field label="Harga jual">
            <input
              className="input input--num"
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set('price', Number(e.target.value) || 0)}
            />
          </Field>
          <Field
            label="Harga modal"
            hint={
              form.price > 0
                ? `Margin ${rp(margin)} · ${marginPct.toFixed(0)}%`
                : undefined
            }
          >
            <input
              className="input input--num"
              type="number"
              min={0}
              value={form.cost}
              onChange={(e) => set('cost', Number(e.target.value) || 0)}
            />
          </Field>
        </div>

        <div className="field-row field-row--2">
          <Field label="Stok">
            <input
              className="input input--num"
              type="number"
              min={0}
              value={form.stock}
              onChange={(e) => set('stock', Number(e.target.value) || 0)}
            />
          </Field>
          <Field label="Satuan">
            <input
              className="input"
              value={form.unit}
              placeholder="cup / pcs / porsi"
              onChange={(e) => set('unit', e.target.value)}
            />
          </Field>
        </div>

        <label
          className="field"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <input
            type="checkbox"
            checked={form.active}
            style={{ width: 20, height: 20, accentColor: 'var(--accent)' }}
            onChange={(e) => set('active', e.target.checked)}
          />
          <span>
            <span className="field__label" style={{ display: 'block' }}>
              Tampil di kasir
            </span>
            <span className="field__hint">
              Matikan kalau produk sedang tidak dijual.
            </span>
          </span>
        </label>
      </div>
    </Layer>
  )
}
