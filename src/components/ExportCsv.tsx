import { useState } from 'react'

import { buildCsv, downloadCsv, type CsvSeparator } from '../lib/csv.ts'
import { Icon } from '../lib/icons.tsx'
import { Layer } from './Layer.tsx'
import { useToast } from './Toast.tsx'

export type ExportOption = {
  key: string
  label: string
  defaultValue: string
  choices: { value: string; label: string }[]
  hint?: string
}

export type ExportPayload = {
  filename: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
  /** shown in the layer before downloading, e.g. "rentang 7 hari terakhir" */
  summary?: string
}

/**
 * "Ekspor CSV" button that opens a small layer forcing the user to pick the
 * options first — the payload is built from those options, so the download
 * always matches what the layer previews.
 */
export function ExportCsvButton({
  title = 'Ekspor CSV',
  label = 'Ekspor CSV',
  options = [],
  build,
  compact = false,
}: {
  title?: string
  label?: string
  options?: ExportOption[]
  build: (values: Record<string, string>) => ExportPayload
  compact?: boolean
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(options.map((o) => [o.key, o.defaultValue])),
  )

  const payload = open ? build(values) : null
  const rowCount = payload?.rows.length ?? 0

  const doExport = () => {
    if (!payload || rowCount === 0) return
    const sep = (values.separator as CsvSeparator) ?? ','
    downloadCsv(payload.filename, buildCsv(payload.headers, payload.rows, sep))
    setOpen(false)
    toast(`${rowCount} baris diekspor ke ${payload.filename}`)
  }

  return (
    <>
      <button
        className={compact ? 'btn btn--ghost btn--sm' : 'btn btn--ghost'}
        type="button"
        onClick={() => setOpen(true)}
      >
        <Icon name="download" className={compact ? 'ico--sm' : undefined} />
        {label}
      </button>

      {open ? (
        <Layer
          title={title}
          onClose={() => setOpen(false)}
          footer={
            <>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => setOpen(false)}
              >
                Batal
              </button>
              <button
                className="btn btn--primary"
                type="button"
                disabled={rowCount === 0}
                onClick={doExport}
              >
                <Icon name="download" />
                Download CSV
              </button>
            </>
          }
        >
          <div className="stack stack-16">
            {options.map((opt) => (
              <div className="field" key={opt.key}>
                <span className="field__label">{opt.label}</span>
                <select
                  className="select"
                  value={values[opt.key] ?? opt.defaultValue}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [opt.key]: e.target.value }))
                  }
                >
                  {opt.choices.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
                {opt.hint ? (
                  <span className="field__hint">{opt.hint}</span>
                ) : null}
              </div>
            ))}

            <div className="card">
              <div className="card__head">
                <div className="card__title">Pratinjau</div>
                <div className="spacer" />
                <span
                  className={`pill ${rowCount === 0 ? 'pill--warn' : 'pill--accent'}`}
                >
                  {rowCount} baris
                </span>
              </div>
              <div className="card__body">
                {rowCount === 0 || !payload ? (
                  <p className="text-sm text-muted">
                    Nggak ada baris untuk diekspor dengan pilihan ini.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-muted" style={{ marginBottom: 10 }}>
                      {payload.summary ? `${payload.summary} · ` : ''}
                      {payload.headers.length} kolom · file{' '}
                      <span className="num">{payload.filename}</span>
                    </p>
                    <div className="tablewrap">
                      <table className="table" style={{ minWidth: 0 }}>
                        <thead>
                          <tr>
                            {payload.headers.map((h) => (
                              <th key={h}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {payload.rows.slice(0, 3).map((row, i) => (
                            <tr key={i}>
                              {payload.headers.map((_, j) => (
                                <td
                                  key={j}
                                  className={
                                    typeof row[j] === 'number' ? 'num' : undefined
                                  }
                                >
                                  {row[j] === '' || row[j] === null || row[j] === undefined
                                    ? '—'
                                    : String(row[j])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {rowCount > 3 ? (
                      <p className="text-xs text-muted mt-8">
                        +{rowCount - 3} baris lagi di file.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>

            <div className="form-note form-note--info">
              <Icon name="alert" />
              <span>
                Angka ditulis polos (22000) biar bisa langsung dijumlah di
                spreadsheet. Pilih titik koma kalau Excel-mu region Indonesia.
              </span>
            </div>
          </div>
        </Layer>
      ) : null}
    </>
  )
}
