import { supabase, invokeFunction } from './supabase'
import type { Recommendation, RecommendationItem } from '@/types'
import type { RecommendationOutput } from '@/utils/recommendationEngine'

const uid = async () => (await supabase.auth.getUser()).data.user!.id

export const recommendationService = {
  async save(portfolioId: string | null, out: RecommendationOutput, inputs: Record<string, unknown>): Promise<Recommendation> {
    const { data, error } = await supabase.from('recommendations').insert({
      user_id: await uid(), portfolio_id: portfolioId, capital_available: out.capitalAvailable, capital_suggested: out.capitalSuggested,
      positions_count: out.items.length, model_version: out.modelVersion, inputs, summary: out.summary,
    }).select().single()
    if (error) throw error
    if (out.items.length) {
      const { error: iErr } = await supabase.from('recommendation_items').insert(out.items.map((i) => ({
        recommendation_id: data.id, asset_id: i.asset_id, amount: i.amount, weight: i.weight, estimated_quantity: i.estimated_quantity, score: i.score, reasons: i.reasons,
      })))
      if (iErr) throw iErr
    }
    return data
  },
  async list(): Promise<Recommendation[]> {
    const { data, error } = await supabase.from('recommendations').select('*, items:recommendation_items(*, asset:assets(*))').order('created_at', { ascending: false }).limit(20)
    if (error) throw error
    return data as Recommendation[]
  },
  async markExecuted(itemId: string) {
    const { error } = await supabase.from('recommendation_items').update({ executed: true }).eq('id', itemId)
    if (error) throw error
  },
}

export const backtestService = {
  async save(name: string, config: unknown, results: unknown) {
    const { error } = await supabase.from('backtests').insert({ user_id: await uid(), name, config, results })
    if (error) throw error
  },
  async list() {
    const { data, error } = await supabase.from('backtests').select('*').order('created_at', { ascending: false }).limit(20)
    if (error) throw error
    return data as Array<{ id: string; name: string; config: Record<string, unknown>; results: Record<string, unknown>; created_at: string }>
  },
}

/** IA opcional: sólo se invoca si el usuario la activó. El backend vuelve a verificar. */
export const aiService = {
  explain: (kind: 'asset' | 'portfolio' | 'recommendation' | 'scenarios' | 'news', payload: unknown) =>
    invokeFunction<{ text: string; model: string }>('ai-analysis', { kind, payload: payload as Record<string, unknown> }),
}

export type { RecommendationItem }
