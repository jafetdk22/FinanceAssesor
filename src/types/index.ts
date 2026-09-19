export type RiskProfile = 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
export type Frequency = 'ONCE' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'
export type AssetType = 'STOCK' | 'ETF' | 'FUND' | 'BOND' | 'CETES' | 'REIT' | 'CRYPTO' | 'OTHER'
export type TransactionType = 'BUY' | 'SELL' | 'DIVIDEND' | 'INTEREST' | 'FEE' | 'DEPOSIT' | 'WITHDRAWAL' | 'SPLIT' | 'TRANSFER'
export type MarketProvider = 'alpha_vantage' | 'twelve_data'

export interface Profile {
  id: string
  full_name: string | null
  base_currency: string
  risk_profile: RiskProfile
  investment_horizon_years: number
}

export interface ScoreWeights {
  fundamental: number
  technical: number
  risk: number
  valuation: number
  momentum: number
}

export interface AppSettings {
  user_id: string
  emergency_fund_months: number
  emergency_fund_current: number
  liquid_capital: number
  score_weights: ScoreWeights
  recommendation_positions: number
  max_asset_concentration: number
  max_sector_concentration: number
  market_data_provider: MarketProvider
  ai_enabled: boolean
}

export interface IncomeSource {
  id: string; user_id: string; name: string; category: string; amount: number; frequency: Frequency; date: string; notes: string | null
}
export interface Expense {
  id: string; user_id: string; name: string; category: string; amount: number; frequency: Frequency; date: string; notes: string | null
}
export interface Debt {
  id: string; user_id: string; name: string; institution: string | null; principal_amount: number; remaining_amount: number
  interest_rate: number; monthly_payment: number; due_date: string | null
}
export interface FinancialGoal {
  id: string; user_id: string; name: string; target_amount: number; current_amount: number; target_date: string | null; priority: 'LOW' | 'MEDIUM' | 'HIGH'
}

export interface Broker {
  id: string; user_id: string; name: string; country: string | null; currency: string; type: string
  commission_notes: string | null; notes: string | null; active: boolean
}

export interface Asset {
  id: string; symbol: string; name: string; asset_type: AssetType; market: string | null; exchange: string | null
  country: string | null; currency: string; sector: string | null; industry: string | null; isin: string | null; active: boolean
}

export interface AssetPrice {
  asset_id: string; date: string; open: number | null; high: number | null; low: number | null; close: number
  adjusted_close: number | null; volume: number | null; provider: string
}

export interface AssetFundamentals {
  asset_id: string; as_of: string; provider: string
  market_cap: number | null; revenue: number | null; revenue_growth: number | null; eps: number | null; eps_growth: number | null
  net_income: number | null; free_cash_flow: number | null; gross_margin: number | null; operating_margin: number | null
  net_margin: number | null; roe: number | null; roa: number | null; debt_to_equity: number | null; current_ratio: number | null
  pe: number | null; peg: number | null; pb: number | null; dividend_yield: number | null; payout_ratio: number | null; beta: number | null
}

export interface Portfolio {
  id: string; user_id: string; name: string; description: string | null; risk_profile: RiskProfile
  target_horizon_years: number; base_currency: string; created_at: string
}

export interface Position {
  id: string; portfolio_id: string; broker_id: string | null; asset_id: string; quantity: number; average_price: number; currency: string
  asset?: Asset; broker?: Broker | null
}

export interface InvestmentTransaction {
  id: string; user_id: string; portfolio_id: string; broker_id: string | null; asset_id: string | null
  transaction_type: TransactionType; quantity: number; price: number; amount: number; commission: number; currency: string
  transaction_date: string; notes: string | null; created_at: string
  asset?: Asset | null; broker?: Broker | null
}

export interface Factor { label: string; impact: 'positive' | 'negative' | 'neutral'; detail?: string; category: string }

export interface AnalysisExplanation {
  positives: Factor[]
  negatives: Factor[]
  neutral: Factor[]
  missing: string[]
  metrics: Record<string, number | null>
  categories: Record<string, { score: number | null; components: Array<{ metric: string; value: number | null; points: number; max: number; rule: string }> }>
}

export interface AnalysisResult {
  id: string; user_id: string; asset_id: string; analysis_date: string
  fundamental_score: number | null; technical_score: number | null; risk_score: number | null; valuation_score: number | null; momentum_score: number | null
  total_score: number; model_version: string; weights: ScoreWeights; explanation: AnalysisExplanation
  asset?: Asset
}

export interface RecommendationItem {
  id?: string; asset_id: string; amount: number; weight: number; estimated_quantity: number | null; score: number | null; reasons: string[]; executed?: boolean
  asset?: Asset; sector?: string | null; risk?: string
}

export interface Recommendation {
  id: string; user_id: string; portfolio_id: string | null; capital_available: number; capital_suggested: number
  positions_count: number; model_version: string; inputs: Record<string, unknown>; summary: Record<string, unknown>; created_at: string
  items?: RecommendationItem[]
}

export interface Notification {
  id: string; type: string; title: string; body: string | null; read: boolean; created_at: string
}
