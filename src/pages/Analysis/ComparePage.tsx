import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, EmptyState, ErrorAlert, Loading, ScoreBadge } from '@/components/ui'
import { NormalizedChart } from '@/components/charts'
import AssetPicker from '@/components/AssetPicker'
import { useAsync } from '@/hooks/useAsync'
import { analysisService } from '@/services/analysis.service'
import { marketService } from '@/services/market.service'
import { portfolioService } from '@/services/portfolio.service'
import type { AnalysisResult, Asset, AssetFundamentals, AssetPrice } from '@/types'
import { fmtCompact, fmtMoney, fmtNum, fmtPct } from '@/utils/format'
import { computeTechnicalSnapshot, type TechnicalSnapshot } from '@/utils/indicators'

interface Col { asset: Asset; prices: AssetPrice[]; tech: TechnicalSnapshot | null; f: AssetFundamentals | null; an: AnalysisResult | null }

export default function ComparePage() {
  const { data: assets, loading, error, reload } = useAsync(() => portfolioService.listAssets(), [])
  const [selected, setSelected] = useState<(string | null)[]>([null, null])
  const [cols, setCols] = useState<Col[]>([])
  const [busy, setBusy] = useState(false)

  const ids = useMemo(() => selected.filter(Boolean) as string[], [selected])

  useEffect(() => {
    if (!assets || ids.length < 1) { setCols([]); return }
    let cancelled = false
    setBusy(true)
    Promise.all(ids.map(async (id) => {
      const asset = assets.find((a) => a.id === id)!
      const [prices, f, an] = await Promise.all([marketService.getPrices(id, 800), marketService.getFundamentals(id), analysisService.getLatestForAsset(id)])
      return { asset, prices, tech: computeTechnicalSnapshot(prices), f, an } as Col
    })).then((c) => { if (!cancelled) setCols(c) }).finally(() => setBusy(false))
    return () => { cancelled = true }
  }, [ids, assets])

  if (loading) return <Loading />
  if (error) return <ErrorAlert message={error} onRetry={reload} />
  if (!assets) return null

  const rows: Array<[string, (c: Col) => string]> = [
    ['Precio', (c) => fmtMoney(c.tech?.lastClose, c.asset.currency)],
    ['Market Cap', (c) => fmtCompact(c.f?.market_cap)],
    ['Revenue Growth', (c) => fmtPct(c.f?.revenue_growth, 1)],
    ['EPS Growth', (c) => fmtPct(c.f?.eps_growth, 1)],
    ['P/E', (c) => fmtNum(c.f?.pe, 1)],
    ['PEG', (c) => fmtNum(c.f?.peg, 2)],
    ['ROE', (c) => fmtPct(c.f?.roe, 1)],
    ['Debt/Equity', (c) => fmtNum(c.f?.debt_to_equity, 2)],
    ['RSI 14', (c) => fmtNum(c.tech?.rsi14, 1)],
    ['SMA 50', (c) => fmtNum(c.tech?.sma50)],
    ['SMA 200', (c) => fmtNum(c.tech?.sma200)],
    ['Volatilidad', (c) => fmtPct(c.tech?.volatility, 1)],
    ['Drawdown (1A)', (c) => fmtPct(c.tech?.maxDrawdown, 1)],
    ['Rendimiento 1A', (c) => fmtPct(c.tech?.return1y, 1)],
    ['Sharpe', (c) => fmtNum(c.tech?.sharpe, 2)],
  ]

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div><Link to="/analysis" className="small text-decoration-none"><i className="bi bi-arrow-left" /> Ranking</Link><h1 className="page-title">Comparar acciones</h1></div>
      </div>
      <Card className="mb-3" title="Selecciona de 2 a 5 instrumentos" actions={selected.length < 5 && <button className="btn btn-sm btn-outline-primary" onClick={() => setSelected([...selected, null])}><i className="bi bi-plus" /> Agregar</button>}>
        <div className="row g-2">
          {selected.map((v, i) => (
            <div className="col-md-6 col-xl-4" key={i}><div className="d-flex gap-1">
              <div className="flex-grow-1"><AssetPicker assets={assets} value={v} onChange={(a) => setSelected(selected.map((x, j) => (j === i ? a?.id ?? null : x)))} /></div>
              {selected.length > 2 && <button className="btn btn-outline-secondary" onClick={() => setSelected(selected.filter((_, j) => j !== i))}><i className="bi bi-x" /></button>}
            </div></div>
          ))}
        </div>
      </Card>
      {busy && <Loading text="Cargando datos…" />}
      {!busy && cols.length < 2 && <Card><EmptyState icon="columns-gap" title="Selecciona al menos 2 instrumentos" /></Card>}
      {!busy && cols.length >= 2 && (
        <>
          <Card className="mb-3" title="Rendimiento comparado (base 100)">
            <NormalizedChart series={cols.filter((c) => c.prices.length).map((c) => ({ name: c.asset.symbol, data: [...c.prices].sort((a, b) => a.date.localeCompare(b.date)).slice(-504).map((p) => ({ date: p.date, close: Number(p.adjusted_close ?? p.close) })) }))} />
          </Card>
          <Card title="Métricas">
            <div className="table-responsive"><table className="table table-bordered align-middle">
              <thead><tr><th style={{ width: 180 }}>Métrica</th>{cols.map((c) => <th key={c.asset.id} className="text-center"><Link to={`/market/${c.asset.id}`} className="text-decoration-none">{c.asset.symbol}</Link><div className="small text-muted fw-normal">{c.asset.name}</div></th>)}</tr></thead>
              <tbody>
                <tr><td className="fw-semibold">Score</td>{cols.map((c) => <td key={c.asset.id} className="text-center"><ScoreBadge score={c.an?.total_score} /></td>)}</tr>
                {rows.map(([label, fn]) => <tr key={label}><td className="text-muted">{label}</td>{cols.map((c) => <td key={c.asset.id} className="text-center">{fn(c)}</td>)}</tr>)}
              </tbody>
            </table></div>
            <div className="form-text">Los valores "—" indican que el proveedor no entregó ese dato o que no se ha sincronizado.</div>
          </Card>
        </>
      )}
    </>
  )
}
