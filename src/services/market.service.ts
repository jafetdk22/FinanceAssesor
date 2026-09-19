import { invokeFunction, supabase } from './supabase'
import type { AssetFundamentals, AssetPrice } from '@/types'

export interface SymbolSearchResult { symbol: string; name: string; exchange?: string; currency?: string; country?: string; type?: string }

export const marketService = {
  /** Descarga y guarda históricos vía Edge Function (las API keys nunca pasan por el frontend). */
  syncPrices: (assetId: string, full = false) =>
    invokeFunction<{ symbol: string; provider: string; bars: number; from?: string; to?: string }>('market-data', { action: 'sync', asset_id: assetId, full }),

  syncFundamentals: (assetId: string) =>
    invokeFunction<{ symbol: string; provider: string; fundamentals: AssetFundamentals }>('fundamentals', { asset_id: assetId }),

  searchSymbols: (query: string) =>
    invokeFunction<{ results: SymbolSearchResult[] }>('market-data', { action: 'search', query }).then((r) => r.results),

  async getPrices(assetId: string, limit = 1500): Promise<AssetPrice[]> {
    const { data, error } = await supabase.from('asset_prices').select('*').eq('asset_id', assetId)
      .order('date', { ascending: false }).limit(limit)
    if (error) throw error
    // Deduplicar por fecha si hay más de un proveedor (prioriza el más reciente insertado)
    const seen = new Set<string>()
    const out: AssetPrice[] = []
    for (const p of data as AssetPrice[]) {
      if (seen.has(p.date)) continue
      seen.add(p.date); out.push(p)
    }
    return out
  },

  async getPricesForAssets(assetIds: string[], limit = 600): Promise<Map<string, AssetPrice[]>> {
    const map = new Map<string, AssetPrice[]>()
    await Promise.all(assetIds.map(async (id) => map.set(id, await marketService.getPrices(id, limit))))
    return map
  },

  /** Último precio disponible por activo. */
  async getLastPrices(assetIds: string[]): Promise<Map<string, { close: number; date: string }>> {
    const map = new Map<string, { close: number; date: string }>()
    if (!assetIds.length) return map
    // Una consulta por activo (limit 1) es simple y eficiente para portafolios pequeños.
    await Promise.all(assetIds.map(async (id) => {
      const { data } = await supabase.from('asset_prices').select('close, date').eq('asset_id', id).order('date', { ascending: false }).limit(1).maybeSingle()
      if (data) map.set(id, { close: Number(data.close), date: data.date })
    }))
    return map
  },

  async getFundamentals(assetId: string): Promise<AssetFundamentals | null> {
    const { data, error } = await supabase.from('asset_fundamentals').select('*').eq('asset_id', assetId)
      .order('as_of', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    return data
  },

  async getFundamentalsForAssets(assetIds: string[]): Promise<Map<string, AssetFundamentals>> {
    const map = new Map<string, AssetFundamentals>()
    await Promise.all(assetIds.map(async (id) => { const f = await marketService.getFundamentals(id); if (f) map.set(id, f) }))
    return map
  },

  async getPriceCoverage(): Promise<Map<string, { from: string; to: string; bars: number }>> {
    const { data, error } = await supabase.from('asset_price_coverage').select('*')
    if (error) throw error
    return new Map((data as { asset_id: string; from_date: string; to_date: string; bars: number }[])
      .map((r) => [r.asset_id, { from: r.from_date, to: r.to_date, bars: Number(r.bars) }]))
  },
}
