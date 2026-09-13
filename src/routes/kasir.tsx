import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Field, Layer } from '../components/Layer.tsx'
import { useToast } from '../components/Toast.tsx'
import { dateTime, initials, rp } from '../lib/format.ts'
import { Icon } from '../lib/icons.tsx'
import { stockLevel } from '../lib/stock.ts'
import type {
  CartLine,
  Customer,
  Order,
  Product,
  StoreSettings,
} from '../lib/types.ts'
import { listCustomers } from '../server/customers.ts'
import { checkout, deleteOrder } from '../server/orders.ts'
import { listProducts } from '../server/products.ts'
import { getSettings } from '../server/settings.ts'

const CART_KEY = 'rontjeu.cart.v1'
const PAYMENTS = ['Tunai', 'QRIS', 'Transfer'] as const

export const Route = createFileRoute('/kasir')({
  loader: async () => {
    const [products, customers, settings] = await Promise.all([
      listProducts(),
      listCustomers(),
      getSettings(),
    ])
    return { products, customers, settings }
  },
  component: KasirPage,
})

function KasirPage() {
  const { products, customers, settings } = Route.useLoaderData()
  const router = useRouter()
  const toast = useToast()

  const [cart, setCart] = useState<CartLine[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('Semua')
  const [flash, setFlash] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [receipt, setReceipt] = useState<Order | null>(null)

  /* ---- cart persistence (client only) ---- */
  const restored = useRef(false)
  useEffect(() => {
    let raw: string | null = null
    try {
      raw = window.localStorage.getItem(CART_KEY)
    } catch {
      raw = null
    }
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as CartLine[]
        if (Array.isArray(parsed)) setCart(parsed)
      } catch {
        /* ignore corrupt cart */
      }
    }
    restored.current = true
  }, [])

  useEffect(() => {
    if (!restored.current) return
    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(cart))
    } catch {
      /* storage unavailable */
    }
  }, [cart])

  /* ---- keep cart lines truthful after katalog edits ---- */
  useEffect(() => {
    setCart((prev) => {
      let changed = false
      const next: CartLine[] = []
      for (const line of prev) {
        const p = products.find((x) => x.id === line.productId)
        if (!p || !p.active) {
          changed = true
          continue
        }
        if (p.price !== line.price || p.stock !== line.stock) {
          changed = true
          next.push({
            ...line,
            price: p.price,
            stock: p.stock,
            name: p.name,
            qty: Math.max(1, Math.min(line.qty, p.stock)),
          })
        } else {
          next.push(line)
        }
      }
      return changed ? next : prev
    })
  }, [products])

  const categories = useMemo(
    () => ['Semua', ...Array.from(new Set(products.map((p) => p.category))).sort()],
    [products],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (!p.active) return false
      if (category !== 'Semua' && p.category !== category) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
      )
    })
  }, [products, category, query])

  const inCart = useCallback(
    (id: string) => cart.find((l) => l.productId === id)?.qty ?? 0,
    [cart],
  )

  const subtotal = cart.reduce((t, l) => t + l.price * l.qty, 0)
  const itemCount = cart.reduce((t, l) => t + l.qty, 0)

  const addToCart = (p: Product) => {
    if (p.stock <= 0) {
      toast(`${p.name} stok habis`, 'warn')
      return
    }
    const already = inCart(p.id)
    if (already + 1 > p.stock) {
      toast(`Stok ${p.name} tinggal ${p.stock}`, 'warn')
      return
    }
    setCart((prev) => {
      const hit = prev.find((l) => l.productId === p.id)
      if (hit) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, qty: l.qty + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price,
          qty: 1,
          stock: p.stock,
          unit: p.unit,
        },
      ]
    })
    setFlash(p.id)
    window.setTimeout(() => setFlash((f) => (f === p.id ? null : f)), 340)
  }

  const setQty = (productId: string, qty: number) => {
    setCart((prev) => {
      const line = prev.find((l) => l.productId === productId)
      if (!line) return prev
      const capped = Math.max(0, Math.min(qty, line.stock))
      if (capped === 0) return prev.filter((l) => l.productId !== productId)
      return prev.map((l) =>
        l.productId === productId ? { ...l, qty: capped } : l,
      )
    })
  }

  const clearCart = () => setCart([])

  /* ---- cart body, shared by the desktop panel and the mobile sheet ---- */
  const cartLines = (
    <>
      {cart.length === 0 ? (
        <div className="empty" style={{ padding: '34px 18px' }}>
          <span className="empty__mark">
            <Icon name="cart" />
          </span>
          <p className="empty__title">Keranjang kosong</p>
          <p className="empty__desc">
            Ketuk produk di sebelah untuk mulai transaksi.
          </p>
        </div>
      ) : (
        cart.map((line) => (
          <div className="cartline" key={line.productId}>
            <div className="stepper">
              <button
                type="button"
                aria-label={`Kurangi ${line.name}`}
                onClick={() => setQty(line.productId, line.qty - 1)}
              >
                <Icon name="minus" />
              </button>
              <span className="stepper__val num">{line.qty}</span>
              <button
                type="button"
                aria-label={`Tambah ${line.name}`}
                disabled={line.qty >= line.stock}
                onClick={() => setQty(line.productId, line.qty + 1)}
              >
                <Icon name="plus" />
              </button>
            </div>
            <div className="cartline__main">
              <div className="cartline__name">{line.name}</div>
              <div className="cartline__unit">
                {rp(line.price)} · stok {line.stock}
              </div>
            </div>
            <div className="cartline__sum num">{rp(line.price * line.qty)}</div>
            <button
              className="icon-btn icon-btn--sm icon-btn--danger"
              type="button"
              aria-label={`Hapus ${line.name}`}
              onClick={() => setQty(line.productId, 0)}
            >
              <Icon name="close" />
            </button>
          </div>
        ))
      )}
    </>
  )

  const summary = (
    <div className="summary">
      <div className="sumrow">
        <span className="sumrow__label">Subtotal</span>
        <span className="num">{rp(subtotal)}</span>
      </div>
      <div className="sumrow">
        <span className="sumrow__label">Total item</span>
        <span className="num">{itemCount}</span>
      </div>
    </div>
  )

  const payButton = (block = false) => (
    <button
      className={`btn btn--primary${block ? ' btn--block' : ''}`}
      type="button"
      disabled={cart.length === 0}
      onClick={() => {
        setSheetOpen(false)
        setCheckoutOpen(true)
      }}
    >
      <Icon name="wallet" />
      Bayar
    </button>
  )

  return (
    <div className="view is-active">
      <div className="pos">
        <div className="pos__catalog">
          <div className="postools">
            <div className="postools__bar">
              <div className="search spacer">
                <Icon name="search" />
                <input
                  className="input"
                  type="search"
                  placeholder="Cari produk atau SKU…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                />
                {query ? (
                  <button
                    type="button"
                    className="search__clear"
                    aria-label="Bersihkan"
                    onClick={() => setQuery('')}
                  >
                    <Icon name="close" className="ico--sm" />
                  </button>
                ) : null}
              </div>
              <span className="postools__count">{visible.length} produk</span>
            </div>
            <div className="chiprow">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip${category === c ? ' is-active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="empty">
              <span className="empty__mark">
                <Icon name="search" />
              </span>
              <p className="empty__title">Produk tidak ditemukan</p>
              <p className="empty__desc">
                Coba kata kunci lain, atau tambah produk baru di Katalog.
              </p>
            </div>
          ) : (
            <div className="pgrid">
              {visible.map((p) => {
                const q = inCart(p.id)
                const level = stockLevel(p.stock, settings.lowStockThreshold)
                const priced = p.price > 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`ptile${level === 'out' ? ' is-out' : ''}${flash === p.id ? ' is-flash' : ''}`}
                    onClick={() => addToCart(p)}
                    aria-label={
                      level === 'out'
                        ? `${p.name} stok habis`
                        : `Tambah ${p.name} ke keranjang`
                    }
                  >
                    {q > 0 ? <span className="ptile__qty">{q}</span> : null}
                    <span className="ptile__cat">{p.category}</span>
                    <span className="ptile__name">{p.name}</span>
                    <span className="ptile__foot">
                      {priced ? (
                        <span className="ptile__price num">{rp(p.price)}</span>
                      ) : (
                        <span className="noprice">Tanpa harga</span>
                      )}
                      <span
                        className={`ptile__stock stocktier${level === 'ok' ? '' : ` is-${level}`}`}
                      >
                        {level === 'out' ? 'habis' : `${p.stock} ${p.unit}`}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="pos__cart">
          <div className="card cartpanel">
            <div className="cartpanel__head">
              <span className="cartpanel__title">Pesanan</span>
              <span className="pill pill--accent">{itemCount} item</span>
              <div className="spacer" />
              <button
                className="icon-btn icon-btn--sm"
                type="button"
                aria-label="Kosongkan keranjang"
                disabled={cart.length === 0}
                onClick={clearCart}
              >
                <Icon name="trash" />
              </button>
            </div>
            <div className="cartpanel__items">{cartLines}</div>
            {cart.length > 0 ? (
              <>
                {summary}
                <div style={{ padding: '0 16px 16px' }}>{payButton(true)}</div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* mobile checkout bar */}
      <div className={`cartbar${cart.length > 0 ? ' is-visible' : ''}`}>
        <button
          className="cartbar__inner"
          type="button"
          onClick={() => setSheetOpen(true)}
        >
          <span className="cartbar__badge">
            <Icon name="cart" />
            <span className="cartbar__n num">{itemCount}</span>
          </span>
          <span className="cartbar__info">
            <span className="cartbar__label">Total</span>
            <span className="cartbar__total" aria-live="polite">
              {rp(subtotal)}
            </span>
          </span>
          <span className="cartbar__go">
            Lihat
            <Icon name="chevron" className="ico--sm" />
          </span>
        </button>
      </div>

      {sheetOpen ? (
        <Layer
          sheet
          title="Pesanan"
          onClose={() => setSheetOpen(false)}
          footer={
            <>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={clearCart}
                disabled={cart.length === 0}
              >
                <Icon name="trash" className="ico--sm" />
                Kosongkan
              </button>
              {payButton()}
            </>
          }
        >
          <div className="card" style={{ boxShadow: 'none' }}>
            {cartLines}
          </div>
          {cart.length > 0 ? summary : null}
        </Layer>
      ) : null}

      {checkoutOpen ? (
        <CheckoutLayer
          cart={cart}
          subtotal={subtotal}
          customers={customers}
          onClose={() => setCheckoutOpen(false)}
          onDone={(order) => {
            setReceipt(order)
            setCart([])
            setCheckoutOpen(false)
            void router.invalidate()
            toast(`Transaksi ${order.code} tersimpan`)
          }}
        />
      ) : null}

      {receipt ? (
        <ReceiptLayer
          order={receipt}
          settings={settings}
          onClose={() => setReceipt(null)}
          onVoid={async () => {
            await deleteOrder({ data: { id: receipt.id } })
            setReceipt(null)
            void router.invalidate()
            toast('Transaksi dibatalkan, stok dikembalikan')
          }}
        />
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Checkout
 * ------------------------------------------------------------------ */
function CheckoutLayer({
  cart,
  subtotal,
  customers,
  onClose,
  onDone,
}: {
  cart: CartLine[]
  subtotal: number
  customers: Customer[]
  onClose: () => void
  onDone: (order: Order) => void
}) {
  const toast = useToast()
  const [discount, setDiscount] = useState(0)
  const [payment, setPayment] = useState<string>('Tunai')
  const [paid, setPaid] = useState(0)
  const [customerId, setCustomerId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const total = Math.max(0, subtotal - Math.min(discount, subtotal))
  const change = Math.max(0, paid - total)
  const short = payment === 'Tunai' && paid > 0 && paid < total

  const quick = useMemo(
    () =>
      Array.from(new Set([total, 50_000, 100_000, 150_000, 200_000]))
        .filter((v) => v >= total)
        .slice(0, 4),
    [total],
  )

  const submit = async () => {
    setBusy(true)
    try {
      const order = await checkout({
        data: {
          items: cart.map((l) => ({ productId: l.productId, qty: l.qty })),
          discount,
          payment,
          paid: payment === 'Tunai' ? paid || total : total,
          customerId: customerId || null,
          note,
        },
      })
      onDone(order)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Transaksi gagal', 'warn')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Layer
      title="Pembayaran"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn btn--primary"
            type="button"
            disabled={busy || short}
            onClick={submit}
          >
            {busy ? <span className="spin" /> : <Icon name="check" />}
            Simpan transaksi
          </button>
        </>
      }
    >
      <div className="stack stack-16">
        <div className="card">
          <div className="card__body">
            {cart.map((l) => (
              <div className="receipt__line" key={l.productId}>
                <span>
                  {l.qty}× {l.name}
                </span>
                <span className="num">{rp(l.price * l.qty)}</span>
              </div>
            ))}
          </div>
        </div>

        <Field label="Diskon (Rp)" hint="Isi 0 kalau tanpa diskon.">
          <input
            className="input input--num"
            type="number"
            min={0}
            max={subtotal}
            value={discount}
            onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
          />
        </Field>

        <div className="field">
          <span className="field__label">Metode pembayaran</span>
          <div className="payopts">
            {PAYMENTS.map((p) => (
              <button
                key={p}
                type="button"
                className={`payopt${payment === p ? ' is-active' : ''}`}
                onClick={() => {
                  setPayment(p)
                  if (p !== 'Tunai') setPaid(total)
                }}
              >
                <Icon name={p === 'Tunai' ? 'wallet' : 'receipt'} />
                {p}
              </button>
            ))}
          </div>
        </div>

        {payment === 'Tunai' ? (
          <div className="field">
            <span className="field__label">Uang diterima</span>
            <input
              className="input input--num"
              type="number"
              min={0}
              placeholder={String(total)}
              value={paid || ''}
              onChange={(e) => setPaid(Math.max(0, Number(e.target.value) || 0))}
            />
            <div className="chiprow chiprow--flush">
              {quick.map((v) => (
                <button
                  key={v}
                  type="button"
                  className="chip"
                  onClick={() => setPaid(v)}
                >
                  {v === total ? 'Uang pas' : rp(v)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Field
          label="Pelanggan"
          hint="Opsional — untuk mencatat riwayat pembelian di CRM."
        >
          <select
            className="select"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Tanpa pelanggan</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.phone ? ` · ${c.phone}` : ''}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Catatan">
          <input
            className="input"
            value={note}
            placeholder="cth. tanpa es, bungkus"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <div className="summary" style={{ borderRadius: 'var(--r-sm)' }}>
          <div className="sumrow">
            <span className="sumrow__label">Subtotal</span>
            <span className="num">{rp(subtotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="sumrow">
              <span className="sumrow__label">Diskon</span>
              <span className="num">−{rp(Math.min(discount, subtotal))}</span>
            </div>
          ) : null}
          <div className="sumrow sumrow--total">
            <span className="sumrow__label">Total</span>
            <span className="num">{rp(total)}</span>
          </div>
          {payment === 'Tunai' && paid > 0 ? (
            <div className="sumrow">
              <span className="sumrow__label">
                {short ? 'Kurang' : 'Kembalian'}
              </span>
              <span className="num">{rp(short ? total - paid : change)}</span>
            </div>
          ) : null}
        </div>

        {short ? (
          <div className="form-note">
            <Icon name="alert" />
            <span>Uang diterima kurang dari total. Cek lagi ya.</span>
          </div>
        ) : null}
      </div>
    </Layer>
  )
}

/* ------------------------------------------------------------------ *
 * Struk
 * ------------------------------------------------------------------ */
function ReceiptLayer({
  order,
  settings,
  onClose,
  onVoid,
}: {
  order: Order
  settings: StoreSettings
  onClose: () => void
  onVoid: () => void | Promise<void>
}) {
  return (
    <Layer
      title={`Struk ${order.code}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--ghost" type="button" onClick={onClose}>
            <Icon name="check" className="ico--sm" />
            Selesai
          </button>
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => window.print()}
          >
            <Icon name="printer" className="ico--sm" />
            Cetak
          </button>
        </>
      }
    >
      <div className="receipt">
        <div className="receipt__store">
          <strong>{settings.storeName}</strong>
          {settings.outlet ? <div>{settings.outlet}</div> : null}
          <div>{dateTime(order.createdAt)}</div>
          <div>
            {order.code} · kasir {settings.cashier}
          </div>
        </div>
        <div className="receipt__dash" />
        {order.items.map((it) => (
          <div className="receipt__line" key={it.id}>
            <span>
              {it.qty}× {it.name}
            </span>
            <span>{rp(it.price * it.qty)}</span>
          </div>
        ))}
        <div className="receipt__dash" />
        <div className="receipt__line">
          <span>Subtotal</span>
          <span>{rp(order.subtotal)}</span>
        </div>
        {order.discount > 0 ? (
          <div className="receipt__line">
            <span>Diskon</span>
            <span>−{rp(order.discount)}</span>
          </div>
        ) : null}
        <div className="receipt__line receipt__total">
          <span>TOTAL</span>
          <span>{rp(order.total)}</span>
        </div>
        <div className="receipt__line">
          <span>{order.payment}</span>
          <span>{rp(order.paid)}</span>
        </div>
        {order.payment === 'Tunai' ? (
          <div className="receipt__line">
            <span>Kembalian</span>
            <span>{rp(Math.max(0, order.paid - order.total))}</span>
          </div>
        ) : null}
        {order.customerName ? (
          <>
            <div className="receipt__dash" />
            <div className="receipt__line">
              <span>Pelanggan</span>
              <span>{initials(order.customerName)} · {order.customerName}</span>
            </div>
          </>
        ) : null}
        {order.note ? (
          <div className="receipt__line">
            <span>Catatan</span>
            <span>{order.note}</span>
          </div>
        ) : null}
        <div className="receipt__foot">
          {settings.footer}
          <div style={{ marginTop: 10 }}>
            <button
              type="button"
              className="btn btn--danger-quiet btn--sm"
              onClick={() => {
                if (
                  window.confirm(
                    `Batalkan ${order.code}? Stok produk akan dikembalikan.`,
                  )
                ) {
                  void onVoid()
                }
              }}
            >
              Batalkan transaksi
            </button>
          </div>
        </div>
      </div>
    </Layer>
  )
}
