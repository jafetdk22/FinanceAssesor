// Análisis de composición y riesgo del portafolio.
import type { AppSettings, AssetPrice, Position } from '@/types'
import { annualizedVolatility, correlation, dailyReturns, maxDrawdown } from './indicators'

export interface ValuedPosition extends Position {
  lastPrice: number | null
  lastPriceDate: string | null
  invested: number
  marketValue: number | null
  pnl: number | null
  pnlPct: number | null
  weight: number | null
}

export function valuePositions(positions: Position[], lastPrices: Map<string, { close: number; date: string }>): ValuedPosition[] {
  const valued = positions.map((p) => {
    const lp = lastPrices.get(p.asset_id)
    const invested = Number(p.quantity) * Number(p.average_price)
    const mv = lp ? Number(p.quantity) * lp.close : null
    return {
      ...p, lastPrice: lp?.close ?? null, lastPriceDate: lp?.date ?? null, invested,
      marketValue: mv, pnl: mv !== null ? mv - invested : null, pnlPct: mv !== null && invested > 0 ? mv / invested - 1 : null, weight: null,
    }
  })
  const total = valued.reduce((s, v) => s + (v.marketValue ?? v.invested), 0)
  return valued.map((v) => ({ ...v, weight: total > 0 ? (v.marketValue ?? v.invested) / total : null }))
}

export interface Bucket { key: string; value: number; weight: number }

export function distribution(valued: ValuedPosition[], keyFn: (p: ValuedPosition) => string): Bucket[] {
  const map = new Map<string, number>()
  let total = 0
  for (const p of valued) {
    const v = p.marketValue ?? p.invested
    total += v
    const k = keyFn(p) || 'Sin dato'
    map.set(k, (map.get(k) ?? 0) + v)
  }
  return [...map.entries()].map(([key, value]) => ({ key, value, weight: total > 0 ? value / total : 0 })).sort((a, b) => b.value - a.value)
}

export interface Alert { level: 'warning' | 'danger' | 'info'; message: string }

export function concentrationAlerts(valued: ValuedPosition[], settings: AppSettings | null): Alert[] {
  const alerts: Alert[] = []
  const maxAsset = Number(settings?.max_asset_concentration ?? 25) / 100
  const maxSector = Number(settings?.max_sector_concentration ?? 40) / 100
  for (const b of distribution(valued, (p) => p.asset?.symbol ?? p.asset_id)) {
    if (b.weight > maxAsset) alerts.push({ level: b.weight > maxAsset * 1.5 ? 'danger' : 'warning', message: `${b.key} representa ${(b.weight * 100).toFixed(1)}% del portafolio (límite ${(maxAsset * 100).toFixed(0)}%)` })
  }
  for (const b of distribution(valued, (p) => p.asset?.sector ?? 'Sin sector')) {
    if (b.weight > maxSector) alerts.push({ level: 'warning', message: `Sector ${b.key} concentra ${(b.weight * 100).toFixed(1)}% (límite ${(maxSector * 100).toFixed(0)}%)` })
  }
  const byCountry = distribution(valued, (p) => p.asset?.country ?? 'Sin país')
  if (byCountry.length === 1 && valued.length > 1) alerts.push({ level: 'info', message: `Todo el portafolio está en un solo país (${byCountry[0].key})` })
  const byCurrency = distribution(valued, (p) => p.currency)
  if (byCurrency.length === 1 && valued.length > 1) alerts.push({ level: 'info', message: `Toda la exposición está en ${byCurrency[0].key}` })
  if (valued.length > 0 && valued.length < 5) alerts.push({ level: 'info', message: `Sólo ${valued.length} posición(es): diversificación limitada` })
  const noPrice = valued.filter((v) => v.lastPrice === null)
  if (noPrice.length) alerts.push({ level: 'warning', message: `${noPrice.length} posición(es) sin precio de mercado; se usa el costo promedio` })
  return alerts
}

/** Índice Herfindahl-Hirschman: 1/n (perfectamente diversificado) ... 1 (una sola posición) */
export const hhi = (valued: ValuedPosition[]) => valued.reduce((s, v) => s + (v.weight ?? 0) ** 2, 0)

export interface PortfolioRisk {
  volatility: number | null
  maxDrawdown: number | null
  days: number
  correlationMatrix: { symbols: string[]; matrix: (number | null)[][] }
  avgCorrelation: number | null
  history: Array<{ date: string; value: number }>
}

/** Serie histórica del valor del portafolio con la composición ACTUAL y métricas de riesgo. */
export function portfolioRisk(valued: ValuedPosition[], pricesByAsset: Map<string, AssetPrice[]>): PortfolioRisk {
  const withData = valued.filter((v) => (pricesByAsset.get(v.asset_id)?.length ?? 0) > 30)
  const empty: PortfolioRisk = { volatility: null, maxDrawdown: null, days: 0, correlationMatrix: { symbols: [], matrix: [] }, avgCorrelation: null, history: [] }
  if (!withData.length) return empty

  // Fechas comunes
  const maps = withData.map((v) => new Map((pricesByAsset.get(v.asset_id) ?? []).map((p) => [p.date, Number(p.adjusted_close ?? p.close)])))
  let dates = [...maps[0].keys()]
  for (const m of maps.slice(1)) dates = dates.filter((d) => m.has(d))
  dates.sort()
  dates = dates.slice(-504)
  if (dates.length < 30) return empty

  const history = dates.map((d) => ({ date: d, value: withData.reduce((s, v, i) => s + Number(v.quantity) * maps[i].get(d)!, 0) }))
  const values = history.map((h) => h.value)
  const rets = dailyReturns(values)
  const retsByAsset = maps.map((m) => dailyReturns(dates.map((d) => m.get(d)!)))
  const symbols = withData.map((v) => v.asset?.symbol ?? v.asset_id)
  const matrix = retsByAsset.map((a) => retsByAsset.map((b) => correlation(a, b)))
  const off: number[] = []
  matrix.forEach((row, i) => row.forEach((c, j) => { if (i < j && c !== null) off.push(c) }))
  return {
    volatility: annualizedVolatility(rets.slice(-252)),
    maxDrawdown: maxDrawdown(values),
    days: dates.length,
    correlationMatrix: { symbols, matrix },
    avgCorrelation: off.length ? off.reduce((a, b) => a + b, 0) / off.length : null,
    history,
  }
}
