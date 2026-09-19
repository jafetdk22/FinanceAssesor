// Indicadores técnicos y métricas de riesgo calculados a partir de precios históricos reales.
// Sin IA. Todo determinista y verificable.
import type { AssetPrice } from '@/types'

export type Series = number[]

export function sma(values: Series, period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= period) sum -= values[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

export function ema(values: Series, period: number): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length < period) return out
  const k = 2 / (period + 1)
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period
  out[period - 1] = prev
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k)
    out[i] = prev
  }
  return out
}

export function rsi(values: Series, period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(values.length).fill(null)
  if (values.length <= period) return out
  let gain = 0, loss = 0
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1]
    if (d > 0) gain += d; else loss -= d
  }
  gain /= period; loss /= period
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1]
    gain = (gain * (period - 1) + Math.max(d, 0)) / period
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss)
  }
  return out
}

export function macd(values: Series, fast = 12, slow = 26, signal = 9) {
  const ef = ema(values, fast), es = ema(values, slow)
  const line: (number | null)[] = values.map((_, i) => (ef[i] !== null && es[i] !== null ? ef[i]! - es[i]! : null))
  const valid = line.map((v) => v ?? 0)
  const firstIdx = line.findIndex((v) => v !== null)
  const sig: (number | null)[] = new Array(values.length).fill(null)
  if (firstIdx >= 0) {
    const sub = ema(valid.slice(firstIdx), signal)
    sub.forEach((v, i) => { sig[firstIdx + i] = v })
  }
  const hist = line.map((v, i) => (v !== null && sig[i] !== null ? v - sig[i]! : null))
  return { line, signal: sig, hist }
}

export function bollinger(values: Series, period = 20, mult = 2) {
  const mid = sma(values, period)
  const upper: (number | null)[] = [], lower: (number | null)[] = []
  for (let i = 0; i < values.length; i++) {
    if (mid[i] === null) { upper.push(null); lower.push(null); continue }
    const slice = values.slice(i - period + 1, i + 1)
    const sd = Math.sqrt(slice.reduce((s, v) => s + (v - mid[i]!) ** 2, 0) / period)
    upper.push(mid[i]! + mult * sd); lower.push(mid[i]! - mult * sd)
  }
  return { mid, upper, lower }
}

export function atr(high: Series, low: Series, close: Series, period = 14): (number | null)[] {
  const tr: number[] = high.map((h, i) => (i === 0 ? h - low[i] : Math.max(h - low[i], Math.abs(h - close[i - 1]), Math.abs(low[i] - close[i - 1]))))
  return ema(tr, period)
}

export function adx(high: Series, low: Series, close: Series, period = 14): (number | null)[] {
  const n = close.length
  const out: (number | null)[] = new Array(n).fill(null)
  if (n <= period * 2) return out
  const plusDM: number[] = [0], minusDM: number[] = [0], tr: number[] = [high[0] - low[0]]
  for (let i = 1; i < n; i++) {
    const up = high[i] - high[i - 1], down = low[i - 1] - low[i]
    plusDM.push(up > down && up > 0 ? up : 0)
    minusDM.push(down > up && down > 0 ? down : 0)
    tr.push(Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1])))
  }
  const smooth = (arr: number[]) => {
    const r: number[] = new Array(n).fill(0)
    let s = arr.slice(1, period + 1).reduce((a, b) => a + b, 0)
    r[period] = s
    for (let i = period + 1; i < n; i++) { s = s - s / period + arr[i]; r[i] = s }
    return r
  }
  const sTR = smooth(tr), sP = smooth(plusDM), sM = smooth(minusDM)
  const dx: number[] = new Array(n).fill(0)
  for (let i = period; i < n; i++) {
    const pdi = sTR[i] ? (100 * sP[i]) / sTR[i] : 0
    const mdi = sTR[i] ? (100 * sM[i]) / sTR[i] : 0
    dx[i] = pdi + mdi ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0
  }
  let a = dx.slice(period, period * 2).reduce((x, y) => x + y, 0) / period
  out[period * 2 - 1] = a
  for (let i = period * 2; i < n; i++) { a = (a * (period - 1) + dx[i]) / period; out[i] = a }
  return out
}

export function obv(close: Series, volume: Series): number[] {
  const out = [0]
  for (let i = 1; i < close.length; i++) {
    out.push(out[i - 1] + (close[i] > close[i - 1] ? volume[i] : close[i] < close[i - 1] ? -volume[i] : 0))
  }
  return out
}

export function dailyReturns(close: Series): number[] {
  const r: number[] = []
  for (let i = 1; i < close.length; i++) r.push(close[i] / close[i - 1] - 1)
  return r
}

export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
export const stdev = (a: number[]) => {
  if (a.length < 2) return 0
  const m = mean(a)
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1))
}

/** Volatilidad anualizada (252 días) */
export const annualizedVolatility = (returns: number[]) => stdev(returns) * Math.sqrt(252)

export function maxDrawdown(close: Series): number {
  let peak = -Infinity, mdd = 0
  for (const c of close) {
    if (c > peak) peak = c
    const dd = c / peak - 1
    if (dd < mdd) mdd = dd
  }
  return mdd // negativo
}

export function sharpeRatio(returns: number[], riskFreeAnnual = 0.04): number | null {
  if (returns.length < 20) return null
  const sd = stdev(returns)
  if (sd === 0) return null
  const excess = mean(returns) - riskFreeAnnual / 252
  return (excess / sd) * Math.sqrt(252)
}

export function beta(assetReturns: number[], benchReturns: number[]): number | null {
  const n = Math.min(assetReturns.length, benchReturns.length)
  if (n < 30) return null
  const a = assetReturns.slice(-n), b = benchReturns.slice(-n)
  const ma = mean(a), mb = mean(b)
  let cov = 0, varB = 0
  for (let i = 0; i < n; i++) { cov += (a[i] - ma) * (b[i] - mb); varB += (b[i] - mb) ** 2 }
  return varB === 0 ? null : cov / varB
}

export function correlation(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length)
  if (n < 30) return null
  const x = a.slice(-n), y = b.slice(-n)
  const mx = mean(x), my = mean(y)
  let num = 0, dx = 0, dy = 0
  for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2 }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? null : num / den
}

/** Momentum: rendimiento de N días */
export const momentum = (close: Series, days: number): number | null =>
  close.length > days ? close[close.length - 1] / close[close.length - 1 - days] - 1 : null

export interface TechnicalSnapshot {
  lastClose: number
  lastDate: string
  bars: number
  sma20: number | null; sma50: number | null; sma200: number | null
  ema20: number | null; ema50: number | null; ema200: number | null
  rsi14: number | null
  macd: number | null; macdSignal: number | null; macdHist: number | null
  bbUpper: number | null; bbLower: number | null; bbPct: number | null
  atr14: number | null; atrPct: number | null
  adx14: number | null
  obvTrend: number | null
  momentum1m: number | null; momentum3m: number | null; momentum6m: number | null; momentum12m: number | null
  volatility: number | null
  maxDrawdown: number | null
  sharpe: number | null
  beta: number | null
  return1y: number | null
  distToHigh52w: number | null
}

/** Ordena precios ascendente por fecha y calcula un snapshot completo. */
export function computeTechnicalSnapshot(prices: AssetPrice[], benchmarkPrices?: AssetPrice[]): TechnicalSnapshot | null {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length < 2) return null
  const close = sorted.map((p) => Number(p.adjusted_close ?? p.close))
  const high = sorted.map((p) => Number(p.high ?? p.close))
  const low = sorted.map((p) => Number(p.low ?? p.close))
  const vol = sorted.map((p) => Number(p.volume ?? 0))
  const n = close.length
  const last = <T,>(arr: (T | null)[]) => arr[arr.length - 1] ?? null

  const rets = dailyReturns(close)
  const rets1y = rets.slice(-252)
  const close1y = close.slice(-252)
  const m = macd(close)
  const bb = bollinger(close)
  const atrArr = atr(high, low, close)
  const o = obv(close, vol)

  let b: number | null = null
  if (benchmarkPrices && benchmarkPrices.length > 30) {
    const bs = [...benchmarkPrices].sort((x, y) => x.date.localeCompare(y.date))
    const map = new Map(bs.map((p) => [p.date, Number(p.adjusted_close ?? p.close)]))
    const paired = sorted.filter((p) => map.has(p.date))
    const ac = paired.map((p) => Number(p.adjusted_close ?? p.close))
    const bc = paired.map((p) => map.get(p.date)!)
    b = beta(dailyReturns(ac).slice(-252), dailyReturns(bc).slice(-252))
  }

  const lastAtr = last(atrArr)
  const bbU = last(bb.upper), bbL = last(bb.lower)
  return {
    lastClose: close[n - 1],
    lastDate: sorted[n - 1].date,
    bars: n,
    sma20: last(sma(close, 20)), sma50: last(sma(close, 50)), sma200: last(sma(close, 200)),
    ema20: last(ema(close, 20)), ema50: last(ema(close, 50)), ema200: last(ema(close, 200)),
    rsi14: last(rsi(close)),
    macd: last(m.line), macdSignal: last(m.signal), macdHist: last(m.hist),
    bbUpper: bbU, bbLower: bbL,
    bbPct: bbU !== null && bbL !== null && bbU !== bbL ? (close[n - 1] - bbL) / (bbU - bbL) : null,
    atr14: lastAtr, atrPct: lastAtr !== null ? lastAtr / close[n - 1] : null,
    adx14: last(adx(high, low, close)),
    obvTrend: n > 20 ? Math.sign(o[n - 1] - o[n - 21]) : null,
    momentum1m: momentum(close, 21), momentum3m: momentum(close, 63), momentum6m: momentum(close, 126), momentum12m: momentum(close, 252),
    volatility: rets1y.length >= 20 ? annualizedVolatility(rets1y) : null,
    maxDrawdown: close1y.length >= 20 ? maxDrawdown(close1y) : null,
    sharpe: sharpeRatio(rets1y),
    beta: b,
    return1y: momentum(close, Math.min(252, n - 1)),
    distToHigh52w: close1y.length ? close[n - 1] / Math.max(...close1y) - 1 : null,
  }
}

/** Serie completa de indicadores para gráficas */
export function indicatorSeries(prices: AssetPrice[]) {
  const sorted = [...prices].sort((a, b) => a.date.localeCompare(b.date))
  const close = sorted.map((p) => Number(p.adjusted_close ?? p.close))
  const s20 = sma(close, 20), s50 = sma(close, 50), s200 = sma(close, 200), r = rsi(close), m = macd(close), bb = bollinger(close)
  return sorted.map((p, i) => ({
    date: p.date, close: close[i], sma20: s20[i], sma50: s50[i], sma200: s200[i], rsi: r[i],
    macd: m.line[i], macdSignal: m.signal[i], macdHist: m.hist[i], bbUpper: bb.upper[i], bbLower: bb.lower[i],
  }))
}
