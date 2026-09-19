// Motor de scoring cuantitativo (0-100), reproducible y explicable.
// Cada categoría es la suma de reglas con puntos y máximo; se normaliza a 0-100.
// Si faltan datos para una regla, no se cuenta (ni puntos ni máximo) y se registra como "missing".
import type { AnalysisExplanation, AssetFundamentals, Factor, ScoreWeights } from '@/types'
import type { TechnicalSnapshot } from './indicators'
import { SCORING_MODEL_VERSION } from '@/constants'

interface Rule {
  metric: string
  value: number | null | undefined
  max: number
  /** devuelve puntos 0..max */
  score: (v: number) => number
  rule: string
  /** etiqueta cuando es positivo (>= 70% del max), negativo (<= 30%) */
  labelPos: string
  labelNeg: string
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
/** interpola linealmente v entre [a -> 0 puntos, b -> max puntos] */
const linear = (v: number, a: number, b: number, max: number) => clamp(((v - a) / (b - a)) * max, 0, max)

interface CategoryResult {
  score: number | null
  components: Array<{ metric: string; value: number | null; points: number; max: number; rule: string }>
  factors: Factor[]
  missing: string[]
}

function evaluate(category: string, rules: Rule[]): CategoryResult {
  let points = 0, max = 0
  const components: CategoryResult['components'] = []
  const factors: Factor[] = []
  const missing: string[] = []
  for (const r of rules) {
    if (r.value === null || r.value === undefined || !Number.isFinite(r.value)) {
      missing.push(r.metric)
      components.push({ metric: r.metric, value: null, points: 0, max: r.max, rule: r.rule + ' (sin datos)' })
      continue
    }
    const p = r.score(r.value)
    points += p; max += r.max
    components.push({ metric: r.metric, value: r.value, points: Number(p.toFixed(2)), max: r.max, rule: r.rule })
    const ratio = p / r.max
    if (ratio >= 0.7) factors.push({ label: r.labelPos, impact: 'positive', category, detail: `${r.metric}: ${fmtV(r.value)}` })
    else if (ratio <= 0.3) factors.push({ label: r.labelNeg, impact: 'negative', category, detail: `${r.metric}: ${fmtV(r.value)}` })
    else factors.push({ label: r.metric, impact: 'neutral', category, detail: `${r.metric}: ${fmtV(r.value)}` })
  }
  return { score: max > 0 ? (points / max) * 100 : null, components, factors, missing }
}

const fmtV = (v: number) => (Math.abs(v) < 10 ? v.toFixed(3) : v.toFixed(1))

export function fundamentalRules(f: AssetFundamentals | null): Rule[] {
  return [
    { metric: 'revenue_growth', value: f?.revenue_growth, max: 20, score: (v) => linear(v, -0.1, 0.25, 20), rule: '-10% → 0 pts, +25% → 20 pts', labelPos: 'Crecimiento de ingresos', labelNeg: 'Ingresos en contracción' },
    { metric: 'eps_growth', value: f?.eps_growth, max: 20, score: (v) => linear(v, -0.1, 0.3, 20), rule: '-10% → 0 pts, +30% → 20 pts', labelPos: 'Crecimiento de EPS', labelNeg: 'EPS decreciente' },
    { metric: 'net_margin', value: f?.net_margin, max: 15, score: (v) => linear(v, 0, 0.25, 15), rule: '0% → 0 pts, 25% → 15 pts', labelPos: 'Margen neto sólido', labelNeg: 'Margen neto bajo o negativo' },
    { metric: 'operating_margin', value: f?.operating_margin, max: 10, score: (v) => linear(v, 0, 0.3, 10), rule: '0% → 0 pts, 30% → 10 pts', labelPos: 'Margen operativo alto', labelNeg: 'Margen operativo débil' },
    { metric: 'roe', value: f?.roe, max: 15, score: (v) => linear(v, 0, 0.25, 15), rule: '0% → 0 pts, 25% → 15 pts', labelPos: 'ROE elevado', labelNeg: 'ROE bajo' },
    { metric: 'roa', value: f?.roa, max: 5, score: (v) => linear(v, 0, 0.12, 5), rule: '0% → 0 pts, 12% → 5 pts', labelPos: 'ROA saludable', labelNeg: 'ROA bajo' },
    { metric: 'debt_to_equity', value: f?.debt_to_equity, max: 10, score: (v) => linear(-v, -2.5, -0.2, 10), rule: 'D/E 2.5 → 0 pts, 0.2 → 10 pts', labelPos: 'Bajo apalancamiento', labelNeg: 'Apalancamiento elevado' },
    { metric: 'current_ratio', value: f?.current_ratio, max: 5, score: (v) => linear(v, 0.8, 2, 5), rule: '0.8 → 0 pts, 2.0 → 5 pts', labelPos: 'Liquidez adecuada', labelNeg: 'Liquidez ajustada' },
  ]
}

export function technicalRules(t: TechnicalSnapshot | null): Rule[] {
  const above = (p?: number | null, m?: number | null) => (p != null && m != null ? p / m - 1 : null)
  return [
    { metric: 'price_vs_sma200', value: above(t?.lastClose, t?.sma200), max: 25, score: (v) => linear(v, -0.15, 0.1, 25), rule: '-15% bajo SMA200 → 0, +10% sobre → 25', labelPos: 'Precio sobre SMA 200 (tendencia positiva)', labelNeg: 'Precio bajo SMA 200 (tendencia negativa)' },
    { metric: 'price_vs_sma50', value: above(t?.lastClose, t?.sma50), max: 15, score: (v) => linear(v, -0.1, 0.08, 15), rule: '-10% → 0, +8% → 15', labelPos: 'Precio sobre SMA 50', labelNeg: 'Precio bajo SMA 50' },
    { metric: 'sma50_vs_sma200', value: above(t?.sma50, t?.sma200), max: 15, score: (v) => linear(v, -0.05, 0.05, 15), rule: 'Cruce dorado/muerte: -5% → 0, +5% → 15', labelPos: 'SMA 50 sobre SMA 200', labelNeg: 'SMA 50 bajo SMA 200' },
    { metric: 'rsi14', value: t?.rsi14, max: 15, score: (v) => (v < 30 ? 6 : v > 70 ? 4 : 15 - Math.abs(v - 55) * 0.4), rule: 'Óptimo cerca de 55; sobrecompra/sobreventa penalizan', labelPos: 'RSI en zona saludable', labelNeg: 'RSI en zona extrema' },
    { metric: 'macd_hist', value: t?.macdHist != null && t?.lastClose ? t.macdHist / t.lastClose : null, max: 10, score: (v) => linear(v, -0.01, 0.01, 10), rule: 'Histograma MACD normalizado por precio', labelPos: 'MACD positivo', labelNeg: 'MACD negativo' },
    { metric: 'adx14', value: t?.adx14, max: 10, score: (v) => linear(v, 10, 35, 10), rule: 'ADX 10 → 0, 35 → 10 (fuerza de tendencia)', labelPos: 'Tendencia con fuerza (ADX)', labelNeg: 'Sin tendencia definida' },
    { metric: 'obv_trend', value: t?.obvTrend, max: 5, score: (v) => (v > 0 ? 5 : v < 0 ? 0 : 2.5), rule: 'OBV al alza → 5, a la baja → 0', labelPos: 'Volumen acompaña la tendencia', labelNeg: 'Volumen distribuye' },
    { metric: 'ema20_vs_ema50', value: above(t?.ema20, t?.ema50), max: 5, score: (v) => linear(v, -0.03, 0.03, 5), rule: '-3% → 0, +3% → 5', labelPos: 'EMA 20 sobre EMA 50', labelNeg: 'EMA 20 bajo EMA 50' },
  ]
}

export function riskRules(t: TechnicalSnapshot | null, f: AssetFundamentals | null): Rule[] {
  return [
    { metric: 'volatility', value: t?.volatility, max: 30, score: (v) => linear(-v, -0.6, -0.12, 30), rule: 'Vol. anual 60% → 0, 12% → 30', labelPos: 'Volatilidad controlada', labelNeg: 'Volatilidad elevada' },
    { metric: 'max_drawdown', value: t?.maxDrawdown, max: 30, score: (v) => linear(v, -0.5, -0.08, 30), rule: 'Drawdown -50% → 0, -8% → 30', labelPos: 'Drawdown contenido', labelNeg: 'Drawdown histórico considerable' },
    { metric: 'beta', value: t?.beta ?? f?.beta, max: 15, score: (v) => linear(-Math.abs(v - 1), -1, -0.1, 15), rule: 'Beta lejos de 1 penaliza (|β-1| 1 → 0, 0.1 → 15)', labelPos: 'Beta cercana al mercado', labelNeg: 'Beta muy distinta al mercado' },
    { metric: 'sharpe', value: t?.sharpe, max: 15, score: (v) => linear(v, -0.5, 1.5, 15), rule: 'Sharpe -0.5 → 0, 1.5 → 15', labelPos: 'Buen rendimiento ajustado a riesgo', labelNeg: 'Rendimiento ajustado a riesgo pobre' },
    { metric: 'atr_pct', value: t?.atrPct, max: 10, score: (v) => linear(-v, -0.06, -0.01, 10), rule: 'ATR% 6% → 0, 1% → 10', labelPos: 'Rango diario estable', labelNeg: 'Rango diario amplio' },
  ]
}

export function valuationRules(f: AssetFundamentals | null): Rule[] {
  return [
    { metric: 'pe', value: f?.pe != null && f.pe > 0 ? f.pe : f?.pe != null ? 200 : null, max: 30, score: (v) => linear(-v, -50, -10, 30), rule: 'P/E 50 → 0, 10 → 30; negativo = 0', labelPos: 'P/E atractivo', labelNeg: 'Valuación elevada (P/E)' },
    { metric: 'peg', value: f?.peg != null && f.peg > 0 ? f.peg : null, max: 30, score: (v) => linear(-v, -3, -0.8, 30), rule: 'PEG 3 → 0, 0.8 → 30', labelPos: 'PEG razonable', labelNeg: 'PEG elevado' },
    { metric: 'pb', value: f?.pb != null && f.pb > 0 ? f.pb : null, max: 20, score: (v) => linear(-v, -10, -1, 20), rule: 'P/B 10 → 0, 1 → 20', labelPos: 'P/B moderado', labelNeg: 'P/B elevado' },
    { metric: 'dividend_yield', value: f?.dividend_yield, max: 10, score: (v) => linear(v, 0, 0.04, 10), rule: '0% → 0, 4% → 10', labelPos: 'Dividendo atractivo', labelNeg: 'Sin dividendo relevante' },
    { metric: 'payout_ratio', value: f?.payout_ratio, max: 10, score: (v) => (v <= 0 ? 5 : v > 1 ? 0 : linear(-v, -1, -0.3, 10)), rule: 'Payout >100% → 0, ≤30% → 10', labelPos: 'Payout sostenible', labelNeg: 'Payout insostenible' },
  ]
}

export function momentumRules(t: TechnicalSnapshot | null): Rule[] {
  return [
    { metric: 'momentum_3m', value: t?.momentum3m, max: 30, score: (v) => linear(v, -0.15, 0.15, 30), rule: '-15% → 0, +15% → 30', labelPos: 'Momentum 3M positivo', labelNeg: 'Momentum 3M negativo' },
    { metric: 'momentum_6m', value: t?.momentum6m, max: 30, score: (v) => linear(v, -0.2, 0.25, 30), rule: '-20% → 0, +25% → 30', labelPos: 'Momentum 6M positivo', labelNeg: 'Momentum 6M negativo' },
    { metric: 'momentum_12m', value: t?.momentum12m, max: 25, score: (v) => linear(v, -0.25, 0.4, 25), rule: '-25% → 0, +40% → 25', labelPos: 'Momentum 12M positivo', labelNeg: 'Momentum 12M negativo' },
    { metric: 'dist_to_52w_high', value: t?.distToHigh52w, max: 15, score: (v) => linear(v, -0.4, -0.02, 15), rule: '-40% del máximo → 0, -2% → 15', labelPos: 'Cerca de máximos de 52 semanas', labelNeg: 'Lejos de máximos de 52 semanas' },
  ]
}

export interface ScoreOutput {
  total: number
  fundamental: number | null
  technical: number | null
  risk: number | null
  valuation: number | null
  momentum: number | null
  explanation: AnalysisExplanation
  modelVersion: string
  weights: ScoreWeights
  effectiveWeights: ScoreWeights
}

export function validateWeights(w: ScoreWeights): string | null {
  const sum = Object.values(w).reduce((a, b) => a + Number(b || 0), 0)
  if (Math.abs(sum - 100) > 0.01) return `Los pesos deben sumar 100% (actualmente ${sum}%)`
  if (Object.values(w).some((v) => Number(v) < 0)) return 'Los pesos no pueden ser negativos'
  return null
}

/**
 * Calcula el score total. Si una categoría no tiene datos, su peso se redistribuye
 * proporcionalmente entre las demás y esto se documenta en la explicación.
 */
export function computeScore(t: TechnicalSnapshot | null, f: AssetFundamentals | null, weights: ScoreWeights): ScoreOutput {
  const cats = {
    fundamental: evaluate('fundamental', fundamentalRules(f)),
    technical: evaluate('technical', technicalRules(t)),
    risk: evaluate('risk', riskRules(t, f)),
    valuation: evaluate('valuation', valuationRules(f)),
    momentum: evaluate('momentum', momentumRules(t)),
  }
  const keys = Object.keys(cats) as (keyof typeof cats)[]
  const available = keys.filter((k) => cats[k].score !== null && Number(weights[k]) > 0)
  const wSum = available.reduce((s, k) => s + Number(weights[k]), 0)
  const effectiveWeights = { fundamental: 0, technical: 0, risk: 0, valuation: 0, momentum: 0 }
  let total = 0
  for (const k of available) {
    effectiveWeights[k] = wSum > 0 ? (Number(weights[k]) / wSum) * 100 : 0
    total += (cats[k].score! * effectiveWeights[k]) / 100
  }
  const allFactors = keys.flatMap((k) => cats[k].factors)
  const missing = keys.flatMap((k) => cats[k].missing.map((m) => `${k}.${m}`))
  if (wSum < 100 && wSum > 0) missing.push(`Categorías sin datos: peso redistribuido (${keys.filter((k) => !available.includes(k) && Number(weights[k]) > 0).join(', ')})`)

  const metrics: Record<string, number | null> = {}
  keys.forEach((k) => cats[k].components.forEach((c) => { metrics[c.metric] = c.value }))
  if (t) Object.assign(metrics, { last_close: t.lastClose, sma20: t.sma20, sma50: t.sma50, sma200: t.sma200, ema20: t.ema20, ema50: t.ema50, ema200: t.ema200, macd: t.macd, macd_signal: t.macdSignal, bb_pct: t.bbPct, atr14: t.atr14, momentum_1m: t.momentum1m, return_1y: t.return1y })
  if (f) Object.assign(metrics, { market_cap: f.market_cap, revenue: f.revenue, eps: f.eps, free_cash_flow: f.free_cash_flow, gross_margin: f.gross_margin })

  return {
    total: Number(total.toFixed(2)),
    fundamental: cats.fundamental.score, technical: cats.technical.score, risk: cats.risk.score, valuation: cats.valuation.score, momentum: cats.momentum.score,
    modelVersion: SCORING_MODEL_VERSION,
    weights, effectiveWeights,
    explanation: {
      positives: allFactors.filter((x) => x.impact === 'positive'),
      negatives: allFactors.filter((x) => x.impact === 'negative'),
      neutral: allFactors.filter((x) => x.impact === 'neutral'),
      missing,
      metrics,
      categories: Object.fromEntries(keys.map((k) => [k, { score: cats[k].score, components: cats[k].components }])),
    },
  }
}

export const riskLabel = (riskScore: number | null): 'Bajo' | 'Medio' | 'Alto' | 'N/D' =>
  riskScore === null ? 'N/D' : riskScore >= 66 ? 'Bajo' : riskScore >= 40 ? 'Medio' : 'Alto'
