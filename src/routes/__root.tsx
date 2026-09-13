import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  type ErrorComponentProps,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { AppShell } from '../components/AppShell.tsx'
import { ConfirmProvider } from '../components/Layer.tsx'
import { ToastProvider } from '../components/Toast.tsx'
import { Icon } from '../lib/icons.tsx'
import { getShell } from '../server/shell.ts'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content:
          'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=5',
      },
      { name: 'theme-color', content: '#f6f4f0' },
      { title: 'Rontjeu POS' },
      {
        name: 'description',
        content:
          'Rontjeu POS — aplikasi kasir ringan: katalog produk, transaksi, dan CRM pelanggan.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  loader: () => getShell(),
  shellComponent: RootDocument,
  component: RootComponent,
  errorComponent: RootError,
  notFoundComponent: () => (
    <ErrorBox
      title="Halaman tidak ditemukan"
      message="Rute yang kamu buka tidak ada di aplikasi ini."
    />
  ),
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const shell = Route.useLoaderData()
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AppShell shell={shell}>
          <Outlet />
        </AppShell>
      </ConfirmProvider>
    </ToastProvider>
  )
}

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <ErrorBox
      title="Ada yang gagal dimuat"
      message={
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : 'Error tidak diketahui'
      }
      onRetry={() => reset()}
    />
  )
}

function ErrorBox({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="errpage">
      <div className="errpage__box">
        <span className="errpage__mark">
          <Icon name="alert" />
        </span>
        <h1 className="errpage__title">{title}</h1>
        <p className="errpage__msg">{message}</p>
        {onRetry ? (
          <button className="btn btn--ghost" type="button" onClick={onRetry}>
            <Icon name="refresh" className="ico--sm" />
            Coba lagi
          </button>
        ) : null}
      </div>
    </div>
  )
}
