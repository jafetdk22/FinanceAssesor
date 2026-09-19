// Interfaz lógica MarketDataProvider + implementaciones.
// Los secretos SOLO viven aquí (Deno.env) — nunca en el frontend.

export interface PriceBar {
  date: string
  open: number | null
  high: number | null
  low: number | null
  close: number
  adjusted_close: number | null
  volume: number | null
}

export interface Fundamentals {
  as_of: string
  market_cap?: number | null
  revenue?: number | null
  revenue_growth?: number | null
  eps?: number | null
  eps_growth?: number | null
  net_income?: number | null
  free_cash_flow?: number | null
  gross_margin?: number | null
  operating_margin?: number | null
  net_margin?: number | null
  roe?: number | null
  roa?: number | null
  debt_to_equity?: number | null
  current_ratio?: number | null
  pe?: number | null
  peg?: number | null
  pb?: number | null
  dividend_yield?: number | null
  payout_ratio?: number | null
  beta?: number | null
  raw?: unknown
}

export interface MarketDataProvider {
  readonly name: string
  getDailyPrices(symbol: string, outputSize: 'compact' | 'full'): Promise<PriceBar[]>
  getFundamentals?(symbol: string): Promise<Fundamentals | null>
  searchSymbol?(query: string): Promise<Array<{ symbol: string; name: string; exchange?: string; currency?: string; country?: string; type?: string }>>
}

export class ProviderError extends Error {
  constructor(message: string, public code: 'RATE_LIMIT' | 'INVALID_SYMBOL' | 'API_ERROR' | 'TIMEOUT' | 'NOT_CONFIGURED' | 'NO_DATA') {
    super(message)
  }
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '' || v === 'None' || v === '-') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function fetchJson(url: string, timeoutMs = 15000): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (res.status === 429) throw new ProviderError('Rate limit del proveedor', 'RATE_LIMIT')
    if (!res.ok) throw new ProviderError(`HTTP ${res.status}`, 'API_ERROR')
    return await res.json()
  } catch (e) {
    if (e instanceof ProviderError) throw e
    if ((e as Error).name === 'AbortError') throw new ProviderError('Timeout del proveedor', 'TIMEOUT')
    throw new ProviderError((e as Error).message, 'API_ERROR')
  } finally {
    clearTimeout(t)
  }
}

// ---------------- Alpha Vantage ----------------
export class AlphaVantageProvider implements MarketDataProvider {
  readonly name = 'alpha_vantage'
  private key: string
  constructor() {
    const k = Deno.env.get('ALPHA_VANTAGE_API_KEY')
    if (!k) throw new ProviderError('ALPHA_VANTAGE_API_KEY no configurada', 'NOT_CONFIGURED')
    this.key = k
  }

  private check(data: any) {
    if (data?.Note || data?.Information?.includes?.('rate limit') || data?.Information?.includes?.('premium')) {
      throw new ProviderError(data.Note || data.Information, 'RATE_LIMIT')
    }
    if (data?.['Error Message']) throw new ProviderError('Símbolo inválido', 'INVALID_SYMBOL')
  }

  async getDailyPrices(symbol: string, outputSize: 'compact' | 'full'): Promise<PriceBar[]> {
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${encodeURIComponent(symbol)}&outputsize=${outputSize}&apikey=${this.key}`
    const data = await fetchJson(url)
    this.check(data)
    const series = data['Time Series (Daily)']
    if (!series) throw new ProviderError('Sin datos para el símbolo', 'NO_DATA')
    return Object.entries(series).map(([date, v]: [string, any]) => ({
      date,
      open: num(v['1. open']),
      high: num(v['2. high']),
      low: num(v['3. low']),
      close: num(v['4. close']) ?? 0,
      adjusted_close: num(v['5. adjusted close']),
      volume: num(v['6. volume']),
    })).filter((b) => b.close > 0)
  }

  async getFundamentals(symbol: string): Promise<Fundamentals | null> {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${this.key}`
    const d = await fetchJson(url)
    this.check(d)
    if (!d || !d.Symbol) return null
    return {
      as_of: new Date().toISOString().slice(0, 10),
      market_cap: num(d.MarketCapitalization),
      revenue: num(d.RevenueTTM),
      revenue_growth: num(d.QuarterlyRevenueGrowthYOY),
      eps: num(d.EPS),
      eps_growth: num(d.QuarterlyEarningsGrowthYOY),
      net_income: null,
      free_cash_flow: null,
      gross_margin: num(d.GrossProfitTTM) && num(d.RevenueTTM) ? (num(d.GrossProfitTTM)! / num(d.RevenueTTM)!) : null,
      operating_margin: num(d.OperatingMarginTTM),
      net_margin: num(d.ProfitMargin),
      roe: num(d.ReturnOnEquityTTM),
      roa: num(d.ReturnOnAssetsTTM),
      debt_to_equity: null,
      current_ratio: null,
      pe: num(d.PERatio),
      peg: num(d.PEGRatio),
      pb: num(d.PriceToBookRatio),
      dividend_yield: num(d.DividendYield),
      payout_ratio: num(d.PayoutRatio),
      beta: num(d.Beta),
      raw: d,
    }
  }

  async searchSymbol(query: string) {
    const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(query)}&apikey=${this.key}`
    const d = await fetchJson(url)
    this.check(d)
    return (d.bestMatches ?? []).map((m: any) => ({
      symbol: m['1. symbol'], name: m['2. name'], type: m['3. type'], country: m['4. region'], currency: m['8. currency'],
    }))
  }
}

// ---------------- Twelve Data ----------------
export class TwelveDataProvider implements MarketDataProvider {
  readonly name = 'twelve_data'
  private key: string
  constructor() {
    const k = Deno.env.get('TWELVE_DATA_API_KEY')
    if (!k) throw new ProviderError('TWELVE_DATA_API_KEY no configurada', 'NOT_CONFIGURED')
    this.key = k
  }

  private check(d: any) {
    if (d?.status === 'error') {
      if (d.code === 429) throw new ProviderError(d.message, 'RATE_LIMIT')
      if (d.code === 400 || d.code === 404) throw new ProviderError(d.message, 'INVALID_SYMBOL')
      throw new ProviderError(d.message ?? 'Error del proveedor', 'API_ERROR')
    }
  }

  async getDailyPrices(symbol: string, outputSize: 'compact' | 'full'): Promise<PriceBar[]> {
    const size = outputSize === 'full' ? 5000 : 100
    const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${size}&apikey=${this.key}`
    const d = await fetchJson(url)
    this.check(d)
    if (!d.values?.length) throw new ProviderError('Sin datos para el símbolo', 'NO_DATA')
    return d.values.map((v: any) => ({
      date: v.datetime,
      open: num(v.open), high: num(v.high), low: num(v.low),
      close: num(v.close) ?? 0, adjusted_close: num(v.close), volume: num(v.volume),
    })).filter((b: PriceBar) => b.close > 0)
  }

  async getFundamentals(symbol: string): Promise<Fundamentals | null> {
    const stats = await fetchJson(`https://api.twelvedata.com/statistics?symbol=${encodeURIComponent(symbol)}&apikey=${this.key}`)
    this.check(stats)
    const s = stats?.statistics
    if (!s) return null
    const v = s.valuations_metrics ?? {}
    const f = s.financials ?? {}
    const is = f.income_statement ?? {}
    const bs = f.balance_sheet ?? {}
    const cf = f.cash_flow ?? {}
    const dv = s.dividends_and_splits ?? {}
    return {
      as_of: new Date().toISOString().slice(0, 10),
      market_cap: num(v.market_capitalization),
      revenue: num(is.revenue_ttm),
      revenue_growth: num(is.quarterly_revenue_growth),
      eps: num(is.diluted_eps_ttm),
      eps_growth: num(is.quarterly_earnings_growth_yoy),
      net_income: num(is.net_income_to_common_ttm),
      free_cash_flow: num(cf.levered_free_cash_flow_ttm),
      gross_margin: num(is.gross_profit_ttm) && num(is.revenue_ttm) ? num(is.gross_profit_ttm)! / num(is.revenue_ttm)! : null,
      operating_margin: num(f.operating_margin),
      net_margin: num(f.profit_margin),
      roe: num(f.return_on_equity_ttm),
      roa: num(f.return_on_assets_ttm),
      debt_to_equity: num(bs.total_debt_to_equity_mrq) !== null ? num(bs.total_debt_to_equity_mrq)! / 100 : null,
      current_ratio: num(bs.current_ratio_mrq),
      pe: num(v.trailing_pe),
      peg: num(v.peg_ratio),
      pb: num(v.price_to_book_mrq),
      dividend_yield: num(dv.forward_annual_dividend_yield),
      payout_ratio: num(dv.payout_ratio),
      beta: num(s.stock_price_summary?.beta),
      raw: s,
    }
  }

  async searchSymbol(query: string) {
    const d = await fetchJson(`https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${this.key}`)
    this.check(d)
    return (d.data ?? []).slice(0, 15).map((m: any) => ({
      symbol: m.symbol, name: m.instrument_name, exchange: m.exchange, currency: m.currency, country: m.country, type: m.instrument_type,
    }))
  }
}

export function getProvider(name: string): MarketDataProvider {
  switch (name) {
    case 'alpha_vantage': return new AlphaVantageProvider()
    case 'twelve_data': return new TwelveDataProvider()
    default: throw new ProviderError(`Proveedor desconocido: ${name}`, 'API_ERROR')
  }
}
