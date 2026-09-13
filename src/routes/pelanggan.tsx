import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

import { Field, Layer, useConfirm } from '../components/Layer.tsx'
import { ExportCsvButton } from '../components/ExportCsv.tsx'
import { useToast } from '../components/Toast.tsx'
import { csvDate, csvFilename, joinTags, SEPARATORS } from '../lib/csv.ts'
import { dateLong, initials, relDay, rp } from '../lib/format.ts'
import { Icon } from '../lib/icons.tsx'
import type { Customer, CustomerInput } from '../lib/types.ts'
import {
  addCustomerNote,
  createCustomer,
  deleteCustomer,
  deleteCustomerNote,
  listCustomers,
  updateCustomer,
} from '../server/customers.ts'

export const Route = createFileRoute('/pelanggan')({
  loader: () => listCustomers(),
  component: CrmPage,
})

const TIERS = ['Basic', 'Silver', 'Gold'] as const
const EMPTY: CustomerInput = {
  name: '',
  phone: '',
  email: '',
  tier: 'Basic',
  tags: [],
}

type Draft = { id: string | null; form: CustomerInput }
type Sort = 'Terbaru' | 'Paling loyal' | 'Nama'

function CrmPage() {
  const customers = Route.useLoaderData()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()

  const [query, setQuery] = useState('')
  const [tier, setTier] = useState<'Semua' | (typeof TIERS)[number]>('Semua')
  const [sort, setSort] = useState<Sort>('Terbaru')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // derived from fresh loader data, so an open detail panel refreshes itself
  const selected = customers.find((c) => c.id === selectedId) ?? null

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = customers.filter((c) => {
      if (tier !== 'Semua' && c.tier !== tier) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
    return list.sort((a, b) => {
      if (sort === 'Nama') return a.name.localeCompare(b.name)
      if (sort === 'Paling loyal') return b.totalSpent - a.totalSpent
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }, [customers, query, tier, sort])

  const remove = async (c: Customer) => {
    const ok = await confirm({
      title: `Hapus ${c.name}?`,
      message:
        'Data pelanggan dan catatannya dihapus permanen. Riwayat transaksi tetap ada tapi tanpa nama pelanggan.',
      confirmLabel: 'Hapus pelanggan',
    })
    if (!ok) return
    try {
      await deleteCustomer({ data: { id: c.id } })
      setSelectedId(null)
      await router.invalidate()
      toast('Pelanggan dihapus')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus', 'warn')
    }
  }

  return (
    <div className="view is-active">
      <div className="pagehead">
        <div className="pagehead__row">
          <div className="pagehead__lead">
            <h1 className="pagehead__title">Pelanggan</h1>
            <p className="pagehead__desc">
              {customers.length} pelanggan · {visible.length} tampil
            </p>
          </div>
          <ExportCsvButton
            title="Ekspor pelanggan"
            options={[
              {
                key: 'scope',
                label: 'Data yang diekspor',
                defaultValue: 'shown',
                choices: [
                  { value: 'shown', label: `Yang tampil (${visible.length})` },
                  { value: 'all', label: `Semua pelanggan (${customers.length})` },
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
              const list = v.scope === 'shown' ? visible : customers
              return {
                filename: csvFilename('pelanggan'),
                headers: [
                  'Nama',
                  'Nomor HP',
                  'Email',
                  'Tier',
                  'Tag',
                  'Total Order',
                  'Total Belanja (Rp)',
                  'Rata-rata / Transaksi (Rp)',
                  'Kunjungan Terakhir',
                  'Pelanggan Sejak',
                  'Catatan Terakhir',
                ],
                rows: list.map((c) => [
                  c.name,
                  c.phone,
                  c.email,
                  c.tier,
                  joinTags(c.tags),
                  c.orderCount,
                  c.totalSpent,
                  c.orderCount
                    ? Math.round(c.totalSpent / c.orderCount)
                    : 0,
                  c.lastOrderAt ? csvDate(c.lastOrderAt) : '',
                  csvDate(c.createdAt),
                  c.notes[0]?.text ?? '',
                ]),
                summary:
                  v.scope === 'shown'
                    ? `${visible.length} pelanggan hasil filter`
                    : `${customers.length} pelanggan`,
              }
            }}
          />
          <button
            className="btn btn--primary"
            type="button"
            onClick={() => setDraft({ id: null, form: { ...EMPTY } })}
          >
            <Icon name="plus" />
            Pelanggan baru
          </button>
        </div>
      </div>

      <div className="crmbar">
        <div className="search">
          <Icon name="search" />
          <input
            className="input"
            type="search"
            placeholder="Cari nama, nomor HP, tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>
        <select
          className="select"
          style={{ width: 'auto', minWidth: 140 }}
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
        >
          {(['Terbaru', 'Paling loyal', 'Nama'] as Sort[]).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      <div className="catalogbar">
        <div className="chiprow chiprow--flush">
          {(['Semua', ...TIERS] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`chip${tier === t ? ' is-active' : ''}`}
              onClick={() => setTier(t)}
            >
              {t}
              <span className="chip__n">
                {t === 'Semua'
                  ? customers.length
                  : customers.filter((c) => c.tier === t).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        customers.length === 0 ? (
          <div className="empty">
            <span className="empty__mark">
              <Icon name="users" />
            </span>
            <p className="empty__title">Belum ada pelanggan</p>
            <p className="empty__desc">
              Simpan pelanggan saat pembayaran di kasir, atau tambah manual di
              sini.
            </p>
            <div className="empty__action">
              <button
                className="btn btn--primary"
                type="button"
                onClick={() => setDraft({ id: null, form: { ...EMPTY } })}
              >
                <Icon name="plus" />
                Pelanggan baru
              </button>
            </div>
          </div>
        ) : (
          <div className="empty">
            <span className="empty__mark">
              <Icon name="search" />
            </span>
            <p className="empty__title">Tidak ada pelanggan yang cocok</p>
            <p className="empty__desc">
              Coba kata kunci lain, atau kembalikan filter tier ke Semua.
            </p>
            <div className="empty__action">
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => {
                  setQuery('')
                  setTier('Semua')
                }}
              >
                <Icon name="refresh" />
                Reset filter
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="crmgrid">
          {visible.map((c) => (
            <button
              key={c.id}
              type="button"
              className="ccard"
              onClick={() => setSelectedId(c.id)}
            >
              <div className="ccard__top">
                <span className="avatar">{initials(c.name)}</span>
                <div className="min0 spacer">
                  <div className="ccard__name">{c.name}</div>
                  <div className="ccard__contact">
                    {c.phone || c.email || 'Belum ada kontak'}
                  </div>
                </div>
                <span className={tierClass(c.tier)}>{c.tier}</span>
              </div>
              <div className="ccard__stats">
                <div className="ccard__stat">
                  <div className="k">Order</div>
                  <div className="v num">{c.orderCount}</div>
                </div>
                <div className="ccard__stat">
                  <div className="k">Belanja</div>
                  <div className="v num">{rp(c.totalSpent)}</div>
                </div>
                <div className="ccard__stat">
                  <div className="k">Terakhir</div>
                  <div className="v" style={{ fontSize: 12.5 }}>
                    {c.lastOrderAt ? relDay(c.lastOrderAt) : '—'}
                  </div>
                </div>
              </div>
              {c.tags.length ? (
                <div className="ccard__tags">
                  {c.tags.map((t) => (
                    <span className="pill" key={t}>
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <CustomerDetail
          customer={selected}
          onClose={() => setSelectedId(null)}
          onEdit={() =>
            setDraft({
              id: selected.id,
              form: {
                name: selected.name,
                phone: selected.phone,
                email: selected.email,
                tier: selected.tier,
                tags: selected.tags,
              },
            })
          }
          onDelete={() => remove(selected)}
        />
      ) : null}

      {draft ? (
        <CustomerFormLayer
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={async (id, message) => {
            setDraft(null)
            setSelectedId(id)
            await router.invalidate()
            toast(message)
          }}
        />
      ) : null}
    </div>
  )
}

function tierClass(tier: string) {
  return `tier tier--${tier.toLowerCase()}`
}

/* ------------------------------------------------------------------ *
 * Detail
 * ------------------------------------------------------------------ */
function CustomerDetail({
  customer,
  onClose,
  onEdit,
  onDelete,
}: {
  customer: Customer
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const addNote = async () => {
    const text = note.trim()
    if (!text) return
    setBusy(true)
    try {
      await addCustomerNote({ data: { customerId: customer.id, text } })
      setNote('')
      await router.invalidate()
      toast('Catatan ditambahkan')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan', 'warn')
    } finally {
      setBusy(false)
    }
  }

  const dropNote = async (id: string) => {
    try {
      await deleteCustomerNote({ data: { id } })
      await router.invalidate()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus', 'warn')
    }
  }

  return (
    <Layer
      title="Detail pelanggan"
      wide
      onClose={onClose}
      footer={
        <>
          <button
            className="btn btn--danger-quiet"
            type="button"
            onClick={onDelete}
          >
            <Icon name="trash" className="ico--sm" />
            Hapus
          </button>
          <button className="btn btn--ghost" type="button" onClick={onEdit}>
            <Icon name="edit" className="ico--sm" />
            Edit
          </button>
          <button className="btn btn--ink" type="button" onClick={onClose}>
            Tutup
          </button>
        </>
      }
    >
      <div className="cdetail__head">
        <span className="avatar avatar--lg">{initials(customer.name)}</span>
        <div className="min0">
          <div className="cdetail__name">{customer.name}</div>
          <div className="cdetail__contact">
            <span className={tierClass(customer.tier)}>{customer.tier}</span>
            {customer.phone ? (
              <span className="iconline">
                <Icon name="phone" className="ico--sm" />
                {customer.phone}
              </span>
            ) : null}
            {customer.email ? (
              <span className="iconline">
                <Icon name="mail" className="ico--sm" />
                {customer.email}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="cdetail__stats">
        <div className="statbox">
          <div className="k">Total order</div>
          <div className="v num">{customer.orderCount}</div>
        </div>
        <div className="statbox">
          <div className="k">Total belanja</div>
          <div className="v num">{rp(customer.totalSpent)}</div>
        </div>
        <div className="statbox">
          <div className="k">Kunjungan terakhir</div>
          <div className="v" style={{ fontSize: 13.5 }}>
            {customer.lastOrderAt ? relDay(customer.lastOrderAt) : 'Belum pernah'}
          </div>
        </div>
      </div>

      {customer.orderCount > 0 ? (
        <p className="text-sm text-muted mb-16">
          Rata-rata belanja{' '}
          <strong className="num">
            {rp(customer.totalSpent / customer.orderCount)}
          </strong>{' '}
          per transaksi · pelanggan sejak {dateLong(customer.createdAt)}.
        </p>
      ) : (
        <p className="text-sm text-muted mb-16">
          Belum ada transaksi tercatat untuk pelanggan ini.
        </p>
      )}

      {customer.tags.length ? (
        <div className="ccard__tags mb-16">
          {customer.tags.map((t) => (
            <span className="pill" key={t}>
              {t}
            </span>
          ))}
        </div>
      ) : null}

      <div className="field" style={{ marginBottom: 12 }}>
        <span className="field__label">Catatan</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            value={note}
            placeholder="cth. alergi susu sapi"
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void addNote()
            }}
          />
          <button
            className="btn btn--ink"
            type="button"
            disabled={busy || !note.trim()}
            onClick={addNote}
          >
            <Icon name="plus" />
          </button>
        </div>
      </div>

      {customer.notes.length ? (
        <div className="notelist">
          {customer.notes.map((n) => (
            <div className="note" key={n.id}>
              <Icon name="note" className="ico--sm" />
              <div className="note__text">
                {n.text}
                <div className="note__at">{dateLong(n.createdAt)}</div>
              </div>
              <button
                className="icon-btn icon-btn--sm icon-btn--danger"
                type="button"
                aria-label="Hapus catatan"
                onClick={() => dropNote(n.id)}
              >
                <Icon name="trash" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          Belum ada catatan. Catatan berguna buat preferensi atau permintaan
          khusus pelanggan.
        </p>
      )}
    </Layer>
  )
}

/* ------------------------------------------------------------------ *
 * Form
 * ------------------------------------------------------------------ */
function CustomerFormLayer({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft
  onClose: () => void
  onSaved: (id: string, message: string) => void | Promise<void>
}) {
  const toast = useToast()
  const [form, setForm] = useState<CustomerInput>(draft.form)
  const [tagInput, setTagInput] = useState('')
  const [busy, setBusy] = useState(false)
  const editing = draft.id !== null

  const set = <K extends keyof CustomerInput>(key: K, value: CustomerInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (!t || form.tags.includes(t) || form.tags.length >= 6) {
      setTagInput('')
      return
    }
    set('tags', [...form.tags, t])
    setTagInput('')
  }

  const save = async () => {
    if (!form.name.trim()) {
      toast('Nama pelanggan wajib diisi', 'warn')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await updateCustomer({ data: { id: draft.id as string, patch: form } })
        await onSaved(draft.id as string, 'Pelanggan diperbarui')
      } else {
        const res = await createCustomer({ data: form })
        await onSaved(res.id, 'Pelanggan ditambahkan')
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyimpan', 'warn')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layer
      title={editing ? 'Edit pelanggan' : 'Pelanggan baru'}
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
        <Field label="Nama pelanggan">
          <input
            className="input"
            value={form.name}
            placeholder="cth. Rani Puspita"
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>

        <div className="field-row field-row--2">
          <Field label="Nomor HP">
            <input
              className="input"
              value={form.phone}
              inputMode="tel"
              placeholder="0812-3456-7890"
              onChange={(e) => set('phone', e.target.value)}
            />
          </Field>
          <Field label="Email">
            <input
              className="input"
              type="email"
              value={form.email}
              placeholder="nama@mail.com"
              onChange={(e) => set('email', e.target.value)}
            />
          </Field>
        </div>

        <div className="field">
          <span className="field__label">Tier</span>
          <div className="segmented" style={{ width: '100%' }}>
            {TIERS.map((t) => (
              <button
                key={t}
                type="button"
                className={form.tier === t ? 'is-active' : ''}
                style={{ flex: 1 }}
                onClick={() => set('tier', t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <span className="field__label">Tag</span>
          <div className="taginput">
            {form.tags.map((t) => (
              <span className="tagpill" key={t}>
                {t}
                <button
                  type="button"
                  aria-label={`Hapus tag ${t}`}
                  onClick={() =>
                    set(
                      'tags',
                      form.tags.filter((x) => x !== t),
                    )
                  }
                >
                  <Icon name="close" />
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              placeholder={form.tags.length ? '' : 'langganan, event…'}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  addTag()
                }
              }}
              onBlur={addTag}
            />
          </div>
          <span className="field__hint">Enter untuk menambah · maks 6 tag.</span>
        </div>
      </div>
    </Layer>
  )
}
