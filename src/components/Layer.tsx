import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { Icon } from '../lib/icons.tsx'

/* ------------------------------------------------------------------ *
 * Layer — bottom sheet on mobile, centered dialog from 620px up.
 * ------------------------------------------------------------------ */
export function Layer({
  title,
  children,
  footer,
  onClose,
  sheet = false,
  wide = false,
}: {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  sheet?: boolean
  wide?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('is-locked')
    const focusable = ref.current?.querySelector<HTMLElement>(
      'input, textarea, select, button:not([data-close])',
    )
    const t = window.setTimeout(() => focusable?.focus(), 120)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('is-locked')
      window.clearTimeout(t)
    }
  }, [onClose])

  return (
    <div
      className={`layer is-in${sheet ? ' layer--sheet' : ''}${wide ? ' layer--wide' : ''}`}
      ref={ref}
    >
      <div className="layer__scrim" data-close onClick={onClose} />
      <div className="layer__panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="layer__head">
          <h2 className="layer__title">{title}</h2>
          <button
            className="icon-btn"
            type="button"
            data-close
            aria-label="Tutup"
            onClick={onClose}
          >
            <Icon name="close" />
          </button>
        </header>
        <div className="layer__body">{children}</div>
        {footer ? <footer className="layer__foot">{footer}</footer> : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * Confirm — promise-based confirmation dialog.
 * ------------------------------------------------------------------ */
type ConfirmOpts = {
  title?: string
  message: string
  confirmLabel?: string
}

const ConfirmCtx = createContext<(opts: ConfirmOpts) => Promise<boolean>>(
  async () => false,
)

export function useConfirm() {
  return useContext(ConfirmCtx)
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOpts & { resolve: (v: boolean) => void }) | null
  >(null)

  const confirm = useCallback(
    (opts: ConfirmOpts) =>
      new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  )

  const settle = useCallback(
    (value: boolean) => {
      state?.resolve(value)
      setState(null)
    },
    [state],
  )

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state ? (
        <Layer
          title={state.title ?? 'Yakin?'}
          onClose={() => settle(false)}
          footer={
            <>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => settle(false)}
              >
                Batal
              </button>
              <button
                className="btn btn--danger"
                type="button"
                onClick={() => settle(true)}
              >
                {state.confirmLabel ?? 'Hapus'}
              </button>
            </>
          }
        >
          <p className="text-muted">{state.message}</p>
        </Layer>
      ) : null}
    </ConfirmCtx.Provider>
  )
}

/* ------------------------------------------------------------------ *
 * Field — label + control wrapper.
 * ------------------------------------------------------------------ */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string | null
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field__label">{label}</span>
      {children}
      {error ? (
        <span className="field__err">{error}</span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </label>
  )
}
