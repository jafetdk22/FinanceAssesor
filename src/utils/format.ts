export const fmtMoney = (v: number | null | undefined, currency = 'USD', digits = 2) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—'
  try {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: digits }).format(v)
  } catch {
    return `${v.toFixed(digits)} ${currency}`
  }
}
export const fmtNum = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('es-MX', { maximumFractionDigits: digits }).format(v)
export const fmtPct = (v: number | null | undefined, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`
export const fmtPctRaw = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v.toFixed(digits)}%`
export const fmtDate = (d: string | null | undefined) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-MX') : '—')
export const fmtCompact = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? '—' : new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(v)
export const today = () => new Date().toISOString().slice(0, 10)
export const pnlClass = (v: number | null | undefined) => (v === null || v === undefined ? '' : v >= 0 ? 'text-success' : 'text-danger')
