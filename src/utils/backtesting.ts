// Backtesting sobre precios históricos reales.
// Estrategias:
//  - BUY_AND_HOLD: pesos iguales entre los activos seleccionados, aportaciones periódicas.
//  - SCORE_THRESHOLD: en cada rebalanceo (mensual) se mantiene sólo activos cuyo score técnico/momentum
//    (calculado con los datos disponibles HASTA esa fecha) supera el umbral. Pesos iguales.
//  - SMA_TREND: mantiene sólo activos cuyo precio está sobre su SMA200 en la fecha de rebalanceo.
import type { AssetPrice, ScoreWeights } from '@/types'
import { annualizedVolatility, computeTechnicalSnapshot, dailyReturns, maxDrawdown, sharpeRatio } from './indicators'
import { computeScore } from './scoring'

export type Strategy = 'BUY_AND_HOLD' | 'SCORE_THRESHOLD' | 'SMA_TREND'

export interface BacktestConfig {
  initialCapital: number
  periodicContribution: number
  startDate: string
  endDate: string
  strategy: Strategy
  scoreThreshold?: number
  commissionPct: number
  assetIds: string[]
  weights: ScoreWeights
}

export interface BacktestResult {
  contributed: number
  finalValue: number
  totalReturn: number
  cagr: number | null
  maxDrawdown: number
  volatility: number | null
  sharpe: number | null
  trades: number
  commissionsPaid: number
  equity: Array<{ date: string; value: number; contributed: number }>
  warnings: string[]
}

export function runBacktest(config: BacktestConfig, pricesByAsset: Map<string, AssetPrice[]>, symbols: Map<string, string>): BacktestResult {
  const warnings: string[] = []
  const series = config.assetIds.map((id) => ({
    id,
    prices: [...(pricesByAsset.get(id) ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
  })).filter((s) => {
    if (s.prices.length < 60) { warnings.push(`${symbols.get(s.id) ?? s.id}: datos insuficientes, excluido`); return false }
    return true
  })
  if (!series.length) throw new Error('No hay activos con datos suficientes')

  // Calendario: fechas comunes en el rango
  let dates = series[0].prices.map((p) => p.date)
  const maps = series.map((s) => new Map(s.prices.map((p) => [p.date, Number(p.adjusted_close ?? p.close)])))
  for (const m of maps.slice(1)) dates = dates.filter((d) => m.has(d))
  dates = dates.filter((d) => d >= config.startDate && d <= config.endDate)
  if (dates.length < 40) throw new Error('El rango de fechas no tiene suficientes datos comunes entre los activos')
  const firstAvailable = series.map((s) => s.prices[0].date).sort().at(-1)!
  if (firstAvailable > config.startDate) warnings.push(`Los datos comunes inician el ${dates[0]} (se solicitó ${config.startDate})`)

  const holdings = new Map<string, number>(series.map((s) => [s.id, 0]))
  let cash = config.initialCapital
  let contributed = config.initialCapital
  let trades = 0, commissions = 0
  const equity: BacktestResult['equity'] = []
  let lastMonth = ''

  const valueAt = (d: string) => cash + series.reduce((s, ser, i) => s + holdings.get(ser.id)! * maps[i].get(d)!, 0)

  const selectAssets = (d: string): string[] => {
    if (config.strategy === 'BUY_AND_HOLD') return series.map((s) => s.id)
    return series.filter((s, i) => {
      const hist = s.prices.filter((p) => p.date <= d)
      if (config.strategy === 'SMA_TREND') {
        if (hist.length < 200) return false
        const closes = hist.slice(-200).map((p) => Number(p.adjusted_close ?? p.close))
        return maps[i].get(d)! > closes.reduce((a, b) => a + b, 0) / 200
      }
      // SCORE_THRESHOLD: score sólo con datos técnicos hasta la fecha (sin fundamentales históricos)
      const snap = computeTechnicalSnapshot(hist.slice(-400))
      if (!snap) return false
      const w = { ...config.weights, fundamental: 0, valuation: 0 }
      return computeScore(snap, null, w).total >= (config.scoreThreshold ?? 60)
    }).map((s) => s.id)
  }

  const rebalance = (d: string, targets: string[]) => {
    const total = valueAt(d)
    const targetW = targets.length ? 1 / targets.length : 0
    for (let i = 0; i < series.length; i++) {
      const id = series[i].id
      const price = maps[i].get(d)!
      const targetQty = targets.includes(id) ? (total * targetW) / price : 0
      const diff = targetQty - holdings.get(id)!
      if (Math.abs(diff * price) < 1) continue
      const gross = Math.abs(diff) * price
      const fee = gross * config.commissionPct
      if (diff > 0 && gross + fee > cash) {
        const affordable = Math.max(cash / (price * (1 + config.commissionPct)), 0)
        if (affordable * price < 1) continue
        holdings.set(id, holdings.get(id)! + affordable)
        cash -= affordable * price * (1 + config.commissionPct)
        commissions += affordable * price * config.commissionPct
      } else {
        holdings.set(id, targetQty)
        cash -= diff * price + fee
        commissions += fee
      }
      trades++
    }
  }

  for (let idx = 0; idx < dates.length; idx++) {
    const d = dates[idx]
    const month = d.slice(0, 7)
    if (month !== lastMonth) {
      if (idx > 0 && config.periodicContribution > 0) { cash += config.periodicContribution; contributed += config.periodicContribution }
      rebalance(d, selectAssets(d))
      lastMonth = month
    }
    equity.push({ date: d, value: valueAt(d), contributed })
  }

  const values = equity.map((e) => e.value)
  const finalValue = values[values.length - 1]
  const years = (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / (365.25 * 24 * 3600 * 1000)
  // CAGR aproximado sobre el capital aportado (money-weighted simplificado)
  const cagr = years > 0.5 && contributed > 0 ? Math.pow(finalValue / contributed, 1 / years) - 1 : null
  const rets = dailyReturns(values)
  return {
    contributed, finalValue, totalReturn: contributed > 0 ? finalValue / contributed - 1 : 0, cagr,
    maxDrawdown: maxDrawdown(values), volatility: rets.length > 20 ? annualizedVolatility(rets) : null, sharpe: sharpeRatio(rets),
    trades, commissionsPaid: commissions, equity, warnings,
  }
}
