// InvestmentRecommendationEngine: propone N instrumentos y una distribución de capital
// usando scores, correlaciones, volatilidad y la composición actual del portafolio.
// Determinista, explicable y sin IA.
import { RECOMMENDATION_MODEL_VERSION } from '@/constants'
import type { AnalysisResult, AppSettings, Asset, AssetPrice, Profile, RecommendationItem, RiskProfile } from '@/types'
import { correlation, dailyReturns } from './indicators'
import { distribution, type ValuedPosition } from './portfolioAnalyzer'
import { riskLabel } from './scoring'

export interface RecommendationInput {
  capital: number
  profile: Profile | null
  settings: AppSettings | null
  valuedPositions: ValuedPosition[]
  candidates: Array<{ asset: Asset; analysis: AnalysisResult }>
  pricesByAsset: Map<string, AssetPrice[]>
  positionsCount?: number
  minScore?: number
}

export interface RecommendationOutput {
  capitalAvailable: number
  capitalSuggested: number
  items: RecommendationItem[]
  summary: {
    minScore: number
    candidatesEvaluated: number
    method: string
    notes: string[]
    riskProfile: RiskProfile
  }
  modelVersion: string
}

const RISK_MIN_SCORE: Record<RiskProfile, number> = { CONSERVATIVE: 65, MODERATE: 55, AGGRESSIVE: 45 }
const RISK_MIN_RISK_SCORE: Record<RiskProfile, number> = { CONSERVATIVE: 55, MODERATE: 35, AGGRESSIVE: 0 }

export function recommend(input: RecommendationInput): RecommendationOutput {
  const riskProfile = input.profile?.risk_profile ?? 'MODERATE'
  const n = input.positionsCount ?? input.settings?.recommendation_positions ?? 5
  const minScore = input.minScore ?? RISK_MIN_SCORE[riskProfile]
  const minRisk = RISK_MIN_RISK_SCORE[riskProfile]
  const maxAsset = Number(input.settings?.max_asset_concentration ?? 25) / 100
  const maxSector = Number(input.settings?.max_sector_concentration ?? 40) / 100
  const notes: string[] = []

  const currentValue = input.valuedPositions.reduce((s, p) => s + (p.marketValue ?? p.invested), 0)
  const futureTotal = currentValue + input.capital
  const sectorDist = new Map(distribution(input.valuedPositions, (p) => p.asset?.sector ?? 'Sin sector').map((b) => [b.key, b.value]))
  const assetValue = new Map(input.valuedPositions.map((p) => [p.asset_id, p.marketValue ?? p.invested]))

  // Retornos del portafolio actual (para correlación)
  const portfolioReturns = portfolioReturnSeries(input.valuedPositions, input.pricesByAsset)

  // 1) Filtrar y puntuar candidatos
  type Scored = { asset: Asset; analysis: AnalysisResult; adjusted: number; corr: number | null; reasons: string[]; penalties: string[] }
  const scored: Scored[] = []
  for (const c of input.candidates) {
    const a = c.analysis
    const reasons: string[] = []
    const penalties: string[] = []
    if (a.total_score < minScore) continue
    if (a.risk_score !== null && a.risk_score < minRisk) { continue }

    let adjusted = a.total_score
    // Correlación con el portafolio actual
    let corr: number | null = null
    const prices = input.pricesByAsset.get(c.asset.id)
    if (portfolioReturns && prices && prices.length > 60) {
      const rets = alignedReturns(prices, portfolioReturns.dates)
      corr = rets ? correlation(rets, portfolioReturns.returns) : null
      if (corr !== null) {
        if (corr < 0.5) { adjusted += 8; reasons.push(`Correlación baja con el portafolio actual (${corr.toFixed(2)})`) }
        else if (corr < 0.8) { adjusted += 3; reasons.push(`Correlación moderada con posiciones actuales (${corr.toFixed(2)})`) }
        else { adjusted -= 6; penalties.push(`Correlación alta con el portafolio actual (${corr.toFixed(2)})`) }
      }
    }
    // Diversificación sectorial
    const sector = c.asset.sector ?? 'Sin sector'
    const sectorWeight = futureTotal > 0 ? (sectorDist.get(sector) ?? 0) / futureTotal : 0
    if (sectorWeight === 0 && currentValue > 0) { adjusted += 6; reasons.push(`Agrega un sector nuevo al portafolio (${sector})`) }
    else if (sectorWeight > maxSector) { adjusted -= 12; penalties.push(`El sector ${sector} ya está concentrado (${(sectorWeight * 100).toFixed(0)}%)`) }
    else if (sectorWeight > maxSector * 0.6) { adjusted -= 4; penalties.push(`El sector ${sector} tiene exposición relevante (${(sectorWeight * 100).toFixed(0)}%)`) }
    // Posición existente
    const existing = assetValue.get(c.asset.id) ?? 0
    if (existing > 0 && futureTotal > 0 && existing / futureTotal > maxAsset * 0.7) { adjusted -= 15; penalties.push('Ya existe una posición relevante en este activo') }

    // Razones cuantitativas del score
    if (a.fundamental_score !== null && a.fundamental_score >= 70) reasons.push(`Score fundamental elevado (${a.fundamental_score.toFixed(0)})`)
    if (a.technical_score !== null && a.technical_score >= 65) reasons.push(`Tendencia técnica positiva (${a.technical_score.toFixed(0)})`)
    if (a.risk_score !== null && a.risk_score >= 60) reasons.push(`Riesgo controlado (score de riesgo ${a.risk_score.toFixed(0)})`)
    if (a.valuation_score !== null && a.valuation_score >= 60) reasons.push(`Valuación razonable (${a.valuation_score.toFixed(0)})`)
    if (a.momentum_score !== null && a.momentum_score >= 65) reasons.push(`Momentum favorable (${a.momentum_score.toFixed(0)})`)
    scored.push({ asset: c.asset, analysis: a, adjusted, corr, reasons, penalties })
  }

  if (!scored.length) {
    notes.push(`Ningún candidato cumple score ≥ ${minScore} y riesgo mínimo para perfil ${riskProfile}. Analiza más activos o ajusta el perfil.`)
    return { capitalAvailable: input.capital, capitalSuggested: 0, items: [], summary: { minScore, candidatesEvaluated: input.candidates.length, method: 'score-adjusted inverse-volatility', notes, riskProfile }, modelVersion: RECOMMENDATION_MODEL_VERSION }
  }

  // 2) Selección greedy con restricción: máximo 2 por sector
  scored.sort((a, b) => b.adjusted - a.adjusted)
  const chosen: Scored[] = []
  const sectorCount = new Map<string, number>()
  for (const s of scored) {
    if (chosen.length >= n) break
    const sec = s.asset.sector ?? 'Sin sector'
    if ((sectorCount.get(sec) ?? 0) >= 2) continue
    chosen.push(s)
    sectorCount.set(sec, (sectorCount.get(sec) ?? 0) + 1)
  }
  if (chosen.length < n) notes.push(`Sólo ${chosen.length} instrumentos cumplen los criterios (se pedían ${n}).`)

  // 3) Pesos: score ajustado × (1 / volatilidad) normalizado, con tope por activo
  const vols = chosen.map((s) => {
    const v = s.analysis.explanation?.metrics?.volatility
    return v && v > 0 ? v : 0.25
  })
  let raw = chosen.map((s, i) => s.adjusted / vols[i])
  let weights = raw.map((r) => r / raw.reduce((a, b) => a + b, 0))
  // Tope: ningún activo puede superar maxAsset del portafolio futuro (considerando lo ya invertido)
  for (let iter = 0; iter < 5; iter++) {
    let overflow = 0
    const capped = weights.map((w, i) => {
      const existing = assetValue.get(chosen[i].asset.id) ?? 0
      const cap = futureTotal > 0 ? Math.max((maxAsset * futureTotal - existing) / input.capital, 0.05) : 1
      if (w > cap) { overflow += w - cap; return cap }
      return w
    })
    if (overflow < 1e-6) { weights = capped; break }
    const free = capped.map((w, i) => (w < weights[i] ? 0 : w))
    const freeSum = free.reduce((a, b) => a + b, 0)
    weights = capped.map((w, i) => (free[i] > 0 && freeSum > 0 ? w + overflow * (w / freeSum) : w))
  }
  const wSum = weights.reduce((a, b) => a + b, 0)
  weights = weights.map((w) => w / wSum)

  const items: RecommendationItem[] = chosen.map((s, i) => {
    const amount = Math.round(input.capital * weights[i] * 100) / 100
    const price = s.analysis.explanation?.metrics?.last_close ?? null
    return {
      asset_id: s.asset.id, asset: s.asset, amount, weight: weights[i] * 100,
      estimated_quantity: price ? Math.floor((amount / price) * 10000) / 10000 : null,
      score: s.analysis.total_score, sector: s.asset.sector, risk: riskLabel(s.analysis.risk_score),
      reasons: [...s.reasons, ...s.penalties.map((p) => `⚠ ${p}`), `Peso = score ajustado (${s.adjusted.toFixed(1)}) / volatilidad (${(vols[i] * 100).toFixed(0)}%), normalizado y con tope de ${(maxAsset * 100).toFixed(0)}% por activo`],
    }
  })

  return {
    capitalAvailable: input.capital,
    capitalSuggested: items.reduce((s, it) => s + it.amount, 0),
    items,
    summary: { minScore, candidatesEvaluated: input.candidates.length, method: 'Score ajustado por diversificación × inverso de volatilidad, tope por activo y máximo 2 por sector', notes, riskProfile },
    modelVersion: RECOMMENDATION_MODEL_VERSION,
  }
}

function portfolioReturnSeries(valued: ValuedPosition[], prices: Map<string, AssetPrice[]>): { dates: string[]; returns: number[] } | null {
  const withData = valued.filter((v) => (prices.get(v.asset_id)?.length ?? 0) > 60)
  if (!withData.length) return null
  const maps = withData.map((v) => new Map((prices.get(v.asset_id) ?? []).map((p) => [p.date, Number(p.adjusted_close ?? p.close)])))
  let dates = [...maps[0].keys()]
  for (const m of maps.slice(1)) dates = dates.filter((d) => m.has(d))
  dates.sort()
  dates = dates.slice(-252)
  if (dates.length < 60) return null
  const values = dates.map((d) => withData.reduce((s, v, i) => s + Number(v.quantity) * maps[i].get(d)!, 0))
  return { dates, returns: dailyReturns(values) }
}

function alignedReturns(prices: AssetPrice[], dates: string[]): number[] | null {
  const m = new Map(prices.map((p) => [p.date, Number(p.adjusted_close ?? p.close)]))
  const closes: number[] = []
  for (const d of dates) { const c = m.get(d); if (c === undefined) return null; closes.push(c) }
  return dailyReturns(closes)
}
