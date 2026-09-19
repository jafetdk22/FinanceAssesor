import { supabase } from './supabase'
import type { Asset, Broker, InvestmentTransaction, Portfolio, Position } from '@/types'

const uid = async () => (await supabase.auth.getUser()).data.user!.id

export const portfolioService = {
  // ---- Brokers ----
  async listBrokers(): Promise<Broker[]> {
    const { data, error } = await supabase.from('brokers').select('*').order('name')
    if (error) throw error
    return data
  },
  async saveBroker(b: Partial<Broker>): Promise<Broker> {
    const payload = { ...b, user_id: await uid() }
    const q = b.id ? supabase.from('brokers').update(payload).eq('id', b.id) : supabase.from('brokers').insert(payload)
    const { data, error } = await q.select().single()
    if (error) throw error
    return data
  },
  async deleteBroker(id: string) {
    const { error } = await supabase.from('brokers').delete().eq('id', id)
    if (error) throw error
  },

  // ---- Assets ----
  async listAssets(): Promise<Asset[]> {
    const { data, error } = await supabase.from('assets').select('*').eq('active', true).order('symbol')
    if (error) throw error
    return data
  },
  async saveAsset(a: Partial<Asset>): Promise<Asset> {
    const payload = { ...a, symbol: a.symbol?.toUpperCase().trim(), created_by: await uid() }
    const q = a.id ? supabase.from('assets').update(payload).eq('id', a.id) : supabase.from('assets').insert(payload)
    const { data, error } = await q.select().single()
    if (error) throw error
    return data
  },
  async findOrCreateAsset(a: Partial<Asset>): Promise<Asset> {
    const symbol = a.symbol!.toUpperCase().trim()
    const { data } = await supabase.from('assets').select('*').ilike('symbol', symbol).limit(1).maybeSingle()
    if (data) return data
    return portfolioService.saveAsset({ ...a, symbol })
  },

  // ---- Portfolios ----
  async listPortfolios(): Promise<Portfolio[]> {
    const { data, error } = await supabase.from('portfolios').select('*').order('created_at')
    if (error) throw error
    return data
  },
  async savePortfolio(p: Partial<Portfolio>): Promise<Portfolio> {
    const payload = { ...p, user_id: await uid() }
    const q = p.id ? supabase.from('portfolios').update(payload).eq('id', p.id) : supabase.from('portfolios').insert(payload)
    const { data, error } = await q.select().single()
    if (error) throw error
    return data
  },
  async deletePortfolio(id: string) {
    const { error } = await supabase.from('portfolios').delete().eq('id', id)
    if (error) throw error
  },

  // ---- Positions (derivadas del ledger) ----
  async listPositions(portfolioId?: string): Promise<Position[]> {
    let q = supabase.from('portfolio_positions').select('*, asset:assets(*), broker:brokers(*)')
    if (portfolioId) q = q.eq('portfolio_id', portfolioId)
    const { data, error } = await q
    if (error) throw error
    return data as Position[]
  },
  async recomputePositions(portfolioId: string) {
    const { error } = await supabase.rpc('recompute_positions', { p_portfolio_id: portfolioId })
    if (error) throw error
  },

  // ---- Transactions ----
  async listTransactions(portfolioId?: string, limit = 500): Promise<InvestmentTransaction[]> {
    let q = supabase.from('investment_transactions').select('*, asset:assets(*), broker:brokers(*)')
      .order('transaction_date', { ascending: false }).order('created_at', { ascending: false }).limit(limit)
    if (portfolioId) q = q.eq('portfolio_id', portfolioId)
    const { data, error } = await q
    if (error) throw error
    return data as InvestmentTransaction[]
  },
  async saveTransaction(t: Partial<InvestmentTransaction>): Promise<InvestmentTransaction> {
    const { asset, broker, ...rest } = t
    void asset; void broker
    const payload = { ...rest, user_id: await uid() }
    const q = t.id ? supabase.from('investment_transactions').update(payload).eq('id', t.id) : supabase.from('investment_transactions').insert(payload)
    const { data, error } = await q.select().single()
    if (error) throw error
    return data
  },
  async deleteTransaction(id: string) {
    const { error } = await supabase.from('investment_transactions').delete().eq('id', id)
    if (error) throw error
  },
}
