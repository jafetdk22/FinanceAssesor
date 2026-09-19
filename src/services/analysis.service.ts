import { supabase } from './supabase'
import { marketService } from './market.service'
import { computeTechnicalSnapshot } from '@/utils/indicators'
import { computeScore, type ScoreOutput } from '@/utils/scoring'
import type { AnalysisResult, Asset, ScoreWeights } from '@/types'
import { today } from '@/utils/format'

const uid = async () => (await supabase.auth.getUser()).data.user!.id

export const analysisService = {
  /** Calcula el score de un activo con los datos almacenados y lo persiste. */
  async analyzeAsset(asset: Asset, weights: ScoreWeights, benchmarkAssetId?: string): Promise<{ result: AnalysisResult; output: ScoreOutput; warnings: string[] }> {
    const warnings: string[] = []
    const [prices, fundamentals, bench] = await Promise.all([
      marketService.getPrices(asset.id, 1500),
      marketService.getFundamentals(asset.id),
      benchmarkAssetId ? marketService.getPrices(benchmarkAssetId, 600) : Promise.resolve([]),
    ])
    if (prices.length < 30) throw new Error(`${asset.symbol}: se requieren al menos 30 días de precios (hay ${prices.length}). Sincroniza el histórico primero.`)
    if (prices.length < 200) warnings.push(`${asset.symbol}: menos de 200 días de datos; SMA/EMA 200 no disponibles.`)
    if (!fundamentals) warnings.push(`${asset.symbol}: sin fundamentales; el peso fundamental/valuación se redistribuye.`)
    const snap = computeTechnicalSnapshot(prices, bench)
    const output = computeScore(snap, fundamentals, weights)

    const row = {
      user_id: await uid(), asset_id: asset.id, analysis_date: today(),
      fundamental_score: output.fundamental, technical_score: output.technical, risk_score: output.risk,
      valuation_score: output.valuation, momentum_score: output.momentum, total_score: output.total,
      model_version: output.modelVersion, weights: output.weights, explanation: output.explanation,
    }
    const { data, error } = await supabase.from('analysis_results').upsert(row, { onConflict: 'user_id,asset_id,analysis_date,model_version' }).select().single()
    if (error) throw error

    // Métricas planas para consultas/ranking
    const metrics = Object.entries(output.explanation.metrics).filter(([, v]) => v !== null && Number.isFinite(v))
      .map(([metric, value]) => ({ analysis_id: data.id, metric, value, category: null }))
    if (metrics.length) {
      await supabase.from('analysis_metrics').delete().eq('analysis_id', data.id)
      const { error: mErr } = await supabase.from('analysis_metrics').insert(metrics)
      if (mErr) console.error('analysis_metrics', mErr)
    }
    return { result: { ...data, asset } as AnalysisResult, output, warnings }
  },

  /** Último resultado por activo (más reciente). */
  async listLatest(): Promise<AnalysisResult[]> {
    const { data, error } = await supabase.from('analysis_results').select('*, asset:assets(*)').order('analysis_date', { ascending: false }).order('created_at', { ascending: false })
    if (error) throw error
    const seen = new Set<string>()
    const out: AnalysisResult[] = []
    for (const r of data as AnalysisResult[]) {
      if (seen.has(r.asset_id)) continue
      seen.add(r.asset_id); out.push(r)
    }
    return out
  },

  async getLatestForAsset(assetId: string): Promise<AnalysisResult | null> {
    const { data, error } = await supabase.from('analysis_results').select('*, asset:assets(*)').eq('asset_id', assetId)
      .order('analysis_date', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    return data
  },

  async history(assetId: string): Promise<AnalysisResult[]> {
    const { data, error } = await supabase.from('analysis_results').select('*').eq('asset_id', assetId).order('analysis_date')
    if (error) throw error
    return data
  },
}
