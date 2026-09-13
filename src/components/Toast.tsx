import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { Icon } from '../lib/icons.tsx'

type Kind = 'ok' | 'warn'
type Item = { id: number; message: string; kind: Kind }

const ToastCtx = createContext<(message: string, kind?: Kind) => void>(() => {})

export function useToast() {
  return useContext(ToastCtx)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const nextId = useRef(1)

  const push = useCallback((message: string, kind: Kind = 'ok') => {
    const id = nextId.current++
    setItems((prev) => [...prev, { id, message, kind }])
    window.setTimeout(
      () => setItems((prev) => prev.filter((t) => t.id !== id)),
      2600,
    )
  }, [])

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-host" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast--${t.kind} is-in`}>
            <Icon name={t.kind === 'warn' ? 'alert' : 'check'} />
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
